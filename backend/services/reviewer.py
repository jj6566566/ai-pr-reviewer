import json
import re
from typing import List, Optional, Tuple

from backend.schemas.review import AnalyzeRequest, AnalyzeResponse, FileInfo, PRInfoResponse, RiskItem, Suggestion
from backend.services.diff_processor import DiffContext, diff_processor
from backend.services.github import PRInfo, github_service
from backend.services.llm import LLMClient, llm_client
from backend.services.risk_scorer import RiskResult, risk_scorer

SYSTEM_PROMPT = """你是一位资深代码评审专家。请对提供的 Pull Request 进行专业分析，输出 JSON 格式结果。

分析维度：
1. summary: PR 的整体变更摘要（100-200字），说明改了什么、为什么改、影响范围
2. risk_items: 识别的高风险代码，包括安全漏洞、逻辑错误、性能问题、并发问题等
   - severity: "critical" | "high" | "medium" | "low"
   - file: 所在文件名
   - line: 行号（无法确定填0）
   - description: 风险描述
   - suggestion: 修复建议
3. suggestions: 改进建议，包括代码质量、可维护性、最佳实践等
   - category: "security" | "performance" | "maintainability" | "best-practice" | "bug-risk"
   - description: 建议描述
   - file: 相关文件
   - code_snippet: 建议的代码片段（可选）

要求：
- 只输出 JSON，不要任何其他文字
- risk_items 只列出真正有风险的问题，空列表优于误报
- suggestions 要具体、可操作，不是泛泛而谈
- 每个维度最多 5 条"""


class ReviewerService:
    def __init__(self, client: Optional[LLMClient] = None):
        self.llm = client or llm_client

    def analyze(self, request: AnalyzeRequest) -> AnalyzeResponse:
        pr_info = github_service.get_pr_info(
            owner=request.owner,
            repo=request.repo,
            pr_number=request.pr_number,
        )
        diff_ctx = diff_processor.process(
            diff_content=pr_info.diff_content,
            files=pr_info.files,
        )
        analysis = self._call_llm(pr_info, diff_ctx)
        return self._build_response(pr_info, diff_ctx, analysis)

    def analyze_stream(self, request: AnalyzeRequest):
        pr_info = github_service.get_pr_info(
            owner=request.owner,
            repo=request.repo,
            pr_number=request.pr_number,
        )
        diff_ctx = diff_processor.process(
            diff_content=pr_info.diff_content,
            files=pr_info.files,
        )
        yield {"event": "progress", "data": {"stage": "fetched", "files_changed": pr_info.files_changed, "additions": pr_info.additions, "deletions": pr_info.deletions}}

        user_message = self._build_user_message(pr_info, diff_ctx)
        buffer = ""
        for chunk in self.llm.chat_stream(system_prompt=SYSTEM_PROMPT, user_message=user_message):
            buffer += chunk
            yield {"event": "token", "data": chunk}

        analysis = self._parse_response(buffer)
        response = self._build_response(pr_info, diff_ctx, analysis)
        yield {"event": "complete", "data": response.model_dump(mode="json")}

    def _build_response(self, pr_info: PRInfo, diff_ctx: DiffContext, analysis: dict) -> AnalyzeResponse:
        risk_items_raw = analysis.get("risk_items", [])
        suggestions_raw = analysis.get("suggestions", [])

        validated_risks = []
        for idx, r in enumerate(risk_items_raw):
            r["confidence"] = self._calculate_confidence(r, pr_info)
            r["is_false_positive"] = self._detect_false_positive(r, pr_info)
            validated_risks.append(RiskItem(**r))

        validated_suggestions = []
        for s in suggestions_raw:
            s["confidence"] = 0.75
            validated_suggestions.append(Suggestion(**s))

        risk_result = risk_scorer.score(
            risk_items=analysis.get("risk_items", []),
            files_changed=pr_info.files_changed,
            additions=pr_info.additions,
            deletions=pr_info.deletions,
        )

        files_response = [
            FileInfo(
                filename=f.filename,
                status=f.status,
                additions=f.additions,
                deletions=f.deletions,
                patch=f.patch,
            )
            for f in pr_info.files
        ]

        return AnalyzeResponse(
            pr_info=PRInfoResponse(
                owner=pr_info.owner,
                repo=pr_info.repo,
                number=pr_info.number,
                title=pr_info.title,
                description=pr_info.description,
                author=pr_info.author,
                base_branch=pr_info.base_branch,
                head_branch=pr_info.head_branch,
                files_changed=pr_info.files_changed,
                additions=pr_info.additions,
                deletions=pr_info.deletions,
                files=files_response,
                diff_content=pr_info.diff_content,
            ),
            summary=self._append_analysis_scope(analysis.get("summary", ""), diff_ctx),
            risk_items=validated_risks,
            suggestions=validated_suggestions,
            risk_score=risk_result.score,
            risk_level=risk_result.level,
            estimated_review_minutes=risk_result.estimated_minutes,
        )

    def _calculate_confidence(self, risk_item: dict, pr_info: PRInfo) -> float:
        confidence = 0.7
        file = risk_item.get("file", "")
        desc = risk_item.get("description", "")
        severity = risk_item.get("severity", "medium")

        file_matches = [f for f in pr_info.files if file in f.filename]
        if file_matches:
            confidence += 0.15
        else:
            confidence -= 0.1

        if severity in ("critical", "high"):
            if len(desc) > 20:
                confidence += 0.05
        else:
            if len(desc) < 10:
                confidence -= 0.1

        security_keywords = ["sql", "injection", "xss", "csrf", "token", "password", "secret", "auth", "bypass", "overflow", "race", "condition"]
        if any(kw in desc.lower() for kw in security_keywords):
            confidence += 0.05

        return round(min(max(confidence, 0.0), 1.0), 2)

    def _detect_false_positive(self, risk_item: dict, pr_info: PRInfo) -> bool:
        file = risk_item.get("file", "")
        desc = risk_item.get("description", "")

        file_matches = [f for f in pr_info.files if file in f.filename]
        if not file_matches:
            return True

        if len(desc) < 5:
            return True

        vague_patterns = ["可以考虑", "建议检查", "可能存在问题", "需要注意", "recommend checking", "potential issue", "might be"]
        is_too_vague = any(p in desc for p in vague_patterns)
        has_specific = len(desc) > 30
        if is_too_vague and not has_specific:
            return True

        return False

    def _call_llm(self, pr_info: PRInfo, diff_ctx: DiffContext) -> dict:
        user_message = self._build_user_message(pr_info, diff_ctx)
        raw = self.llm.chat(system_prompt=SYSTEM_PROMPT, user_message=user_message)
        return self._parse_response(raw)

    def _build_user_message(self, pr_info: PRInfo, diff_ctx: DiffContext) -> str:
        summary_lines = [diff_ctx.summary_text]

        if diff_ctx.change_types:
            change_labels = {
                "db_schema": "数据库 Schema 变更",
                "config": "配置变更",
                "auth": "权限/认证变更",
                "auth_breaking": "权限/认证破坏性变更",
                "api_breaking": "API 破坏性变更（函数签名变化）",
            }
            ct_list = ", ".join(change_labels.get(ct, ct) for ct in diff_ctx.change_types)
            summary_lines.append("变更类型: {}".format(ct_list))

        file_list = "\n".join(
            "  [{status}] {filename} (+{additions}/-{deletions})".format(
                status=f.get("status", "?"),
                filename=f.get("filename", "?"),
                additions=f.get("additions", 0),
                deletions=f.get("deletions", 0),
            )
            for f in diff_ctx.priority_files
        )

        diff_parts = []
        for f in diff_ctx.priority_files:
            fname = f.get("filename", "")
            patch = f.get("patch", "")
            if patch:
                diff_parts.append("--- a/{}".format(fname))
                diff_parts.append("+++ b/{}".format(fname))
                diff_parts.append(patch)
                diff_parts.append("")

        if diff_ctx.low_priority_files:
            diff_parts.append("# 以下为低优文件（截断版 diff，供参考）\n")
            for f in diff_ctx.low_priority_files:
                fname = f.get("filename", "")
                patch = f.get("patch", "")
                if patch:
                    diff_parts.append("--- a/{}".format(fname))
                    diff_parts.append("+++ b/{}".format(fname))
                    diff_parts.append(patch)
                    diff_parts.append("")

        diff = "\n".join(diff_parts)
        max_diff_chars = 30000
        if len(diff) > max_diff_chars:
            diff = diff[:max_diff_chars] + "\n... (diff 超出最大长度，已截断，共 {} 字符)".format(len(diff))

        file_context_section = self._build_file_context_section(pr_info, diff_ctx)

        return """请分析以下 Pull Request：

标题: {title}
描述: {description}
作者: {author}
分支: {head_branch} -> {base_branch}
文件数: {files_changed} | +{additions}/-{deletions}

{summary}

核心文件:
{file_list}

{file_context}代码变更 (diff):
{diff}""".format(
            title=pr_info.title,
            description=pr_info.description or "（无描述）",
            author=pr_info.author,
            head_branch=pr_info.head_branch,
            base_branch=pr_info.base_branch,
            files_changed=pr_info.files_changed,
            additions=pr_info.additions,
            deletions=pr_info.deletions,
            summary="\n".join(summary_lines),
            file_list=file_list,
            file_context=file_context_section,
            diff=diff,
        )

    def _build_file_context_section(self, pr_info: PRInfo, diff_ctx: DiffContext) -> str:
        MAX_CONTEXT_CHARS = 15000
        CONTEXT_LINES = 50
        parts: List[str] = []
        total_chars = 0
        for f in diff_ctx.priority_files:
            fname = f.get("filename", "")
            patch = f.get("patch", "")
            if not fname or not patch:
                continue
            full_content = github_service.get_file_contents(
                owner=pr_info.owner,
                repo=pr_info.repo,
                path=fname,
                ref=pr_info.base_branch,
            )
            if not full_content:
                continue
            context = self._extract_context(full_content, patch, CONTEXT_LINES)
            header = "#### 文件: {}".format(fname)
            footer = "\n以上为该文件的完整代码（含变更上下文）。请结合完整代码理解下文的 diff 变更。"
            block = "```\n完整代码（供理解改动上下文）:\n{}\n```{}".format(context, footer)
            candidate = "{}\n{}".format(header, block)
            if total_chars + len(candidate) > MAX_CONTEXT_CHARS:
                remaining = MAX_CONTEXT_CHARS - total_chars
                min_overhead = len(header) + len("```\n完整代码（供理解改动上下文）:\n\n... (上下文已截断)\n```{}".format(footer))
                if remaining < min_overhead:
                    break
                available_for_code = remaining - len(header) - len("```\n完整代码（供理解改动上下文）:\n\n```{}".format(footer)) - len("\n... (上下文已截断)")
                if available_for_code > 0:
                    truncated_context = context[:available_for_code] + "\n... (上下文已截断)"
                    block = "```\n完整代码（供理解改动上下文）:\n{}\n```{}".format(truncated_context, footer)
                    parts.append("{}\n{}".format(header, block))
                break
            parts.append(candidate)
            total_chars += len(candidate)
        if not parts:
            return ""
        return "### 关键文件完整上下文\n\n{}\n\n".format("\n".join(parts))

    @staticmethod
    def _extract_context(file_content: str, patch: str, context_lines: int = 50) -> str:
        if not file_content:
            return ""
        file_lines = file_content.split("\n")
        total_lines = len(file_lines)
        hunk_pattern = re.compile(r"^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@")
        ranges: List[Tuple[int, int]] = []
        for match in hunk_pattern.finditer(patch):
            old_start = int(match.group(1))
            old_count = int(match.group(2)) if match.group(2) else 1
            ranges.append((old_start, old_start + old_count - 1))
        if not ranges:
            return "\n".join(
                "{:>6}| {}".format(i + 1, line)
                for i, line in enumerate(file_lines[:200])
            )
        ranges.sort()
        merged: List[Tuple[int, int]] = []
        for r in ranges:
            if merged and r[0] <= merged[-1][1] + 1:
                merged[-1] = (merged[-1][0], max(merged[-1][1], r[1]))
            else:
                merged.append(r)
        expanded: List[Tuple[int, int]] = []
        for start, end in merged:
            ctx_start = max(1, start - context_lines)
            ctx_end = min(total_lines, end + context_lines)
            expanded.append((ctx_start, ctx_end))
        final_ranges: List[Tuple[int, int]] = []
        for r in expanded:
            if final_ranges and r[0] <= final_ranges[-1][1] + 1:
                final_ranges[-1] = (final_ranges[-1][0], max(final_ranges[-1][1], r[1]))
            else:
                final_ranges.append(r)
        result_parts: List[str] = []
        for i, (start, end) in enumerate(final_ranges):
            if i > 0:
                skipped = start - final_ranges[i - 1][1] - 1
                result_parts.append("   ... (省略 {} 行) ...".format(skipped))
            for line_no in range(start, end + 1):
                line_text = file_lines[line_no - 1]
                result_parts.append("{:>6}| {}".format(line_no, line_text))
        return "\n".join(result_parts)

    def _parse_response(self, raw: str) -> dict:
        text = raw.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {
                "summary": "AI 分析结果解析失败",
                "risk_items": [],
                "suggestions": [],
            }

    @staticmethod
    def _append_analysis_scope(summary: str, diff_ctx: DiffContext) -> str:
        deep_count = len(diff_ctx.priority_files)
        shallow_count = len(diff_ctx.low_priority_files)
        filtered_count = len(diff_ctx.filtered_files)
        if shallow_count == 0 and filtered_count == 0:
            return summary
        lines = [summary, "", "---", "**分析范围**:"]
        lines.append("- 深度分析（完整代码+上下文）: {} 个文件".format(deep_count))
        if shallow_count:
            lines.append("- 基本分析（截断 diff）: {} 个文件（建议人工复查）".format(shallow_count))
        if filtered_count:
            lines.append("- 自动跳过: {} 个文件（lock/二进制/生成代码）".format(filtered_count))
        return "\n".join(lines)

    @staticmethod
    def _format_review_comment(response: AnalyzeResponse) -> str:
        severity_emoji = {
            "critical": "\U0001f534",
            "high": "\U0001f7e0",
            "medium": "\U0001f7e1",
            "low": "\U0001f7e2",
        }
        category_emoji = {
            "security": "\U0001f512",
            "performance": "\u26a1",
            "maintainability": "\U0001f527",
            "best-practice": "\u2705",
            "bug-risk": "\U0001f41b",
        }
        lines = []
        lines.append("## \U0001f916 AI PR Review \u6458\u8981")
        lines.append("")
        lines.append(
            "**\u98ce\u9669\u8bc4\u5206**: {}/100 ({}) | **\u9884\u8ba1\u5ba1\u67e5\u65f6\u95f4**: ~{} \u5206\u949f".format(
                response.risk_score,
                severity_emoji.get(response.risk_level, "\u26aa") + " " + response.risk_level,
                response.estimated_review_minutes,
            )
        )
        lines.append("")
        if response.summary:
            lines.append("### \U0001f4dd \u53d8\u66f4\u6458\u8981")
            lines.append(response.summary)
            lines.append("")
        if response.risk_items:
            lines.append("### \u26a0\ufe0f \u98ce\u9669\u9879 ({})".format(len(response.risk_items)))
            lines.append("")
            for item in response.risk_items:
                emoji = severity_emoji.get(item.severity, "\u26aa")
                lines.append("- {} **{}/L{}**: {}".format(emoji, item.file, item.line, item.description))
                if item.suggestion:
                    lines.append("  > \U0001f4a1 \u4fee\u590d\u5efa\u8bae: {}".format(item.suggestion))
            lines.append("")
        if response.suggestions:
            lines.append("### \U0001f4a1 \u6539\u8fdb\u5efa\u8bae ({})".format(len(response.suggestions)))
            lines.append("")
            for item in response.suggestions:
                emoji = category_emoji.get(item.category, "\U0001f4cc")
                lines.append("- {} **{}**: {}".format(emoji, item.file or "\u5168\u5c40", item.description))
                if item.code_snippet:
                    lines.append("  ```")
                    lines.append("  {}".format(item.code_snippet))
                    lines.append("  ```")
            lines.append("")
        pr_info = response.pr_info
        lines.append("---")
        lines.append(
            "_Generated by AI PR Reviewer | {}/{} #{}_".format(
                pr_info.owner, pr_info.repo, pr_info.number,
            )
        )
        return "\n".join(lines)


reviewer_service = ReviewerService()
