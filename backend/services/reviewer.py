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

        # 智能 Diff 预处理
        diff_ctx = diff_processor.process(
            diff_content=pr_info.diff_content,
            files=pr_info.files,
        )

        # LLM 分析（传入结构化上下文）
        analysis = self._call_llm(pr_info, diff_ctx)

        # 风险评分计算
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
            summary=analysis.get("summary", ""),
            risk_items=[RiskItem(**r) for r in analysis.get("risk_items", [])],
            suggestions=[Suggestion(**s) for s in analysis.get("suggestions", [])],
            risk_score=risk_result.score,
            risk_level=risk_result.level,
            estimated_review_minutes=risk_result.estimated_minutes,
        )

    def _call_llm(self, pr_info: PRInfo, diff_ctx: DiffContext) -> dict:
        user_message = self._build_user_message(pr_info, diff_ctx)

        raw = self.llm.chat(system_prompt=SYSTEM_PROMPT, user_message=user_message)

        return self._parse_response(raw)

    def _build_user_message(self, pr_info: PRInfo, diff_ctx: DiffContext) -> str:
        # 文件变更统计摘要（由 DiffProcessor 生成）
        summary_lines = [diff_ctx.summary_text]

        # 变更类型标注
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

        # 构建精简的文件列表（仅高优文件）
        file_list = "\n".join(
            "  [{status}] {filename} (+{additions}/-{deletions})".format(
                status=f.get("status", "?"),
                filename=f.get("filename", "?"),
                additions=f.get("additions", 0),
                deletions=f.get("deletions", 0),
            )
            for f in diff_ctx.priority_files
        )

        # 构建智能 diff：高优文件完整 diff + 低优文件截断 diff
        diff_parts = []
        for f in diff_ctx.priority_files:
            fname = f.get("filename", "")
            patch = f.get("patch", "")
            if patch:
                diff_parts.append("--- a/{}".format(fname))
                diff_parts.append("+++ b/{}".format(fname))
                diff_parts.append(patch)
                diff_parts.append("")

        # 低优文件只在 diff_ctx 的 priority_files 中可能包含截断版，
        # 此处已在 _smart_truncate 阶段处理好

        diff = "\n".join(diff_parts)
        # 兜底截断：极特殊情况下的二次保护
        max_diff_chars = 12000
        if len(diff) > max_diff_chars:
            diff = diff[:max_diff_chars] + "\n... (diff 超出最大长度，已截断，共 {} 字符)".format(
                len(diff)
            )

        # ---- M4: 构建关键文件完整上下文章节 ----
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
        """构建关键文件完整上下文章节。

        对于 diff_ctx.priority_files 中的每个高优文件，
        调用 GitHub API 获取 base 分支的完整文件内容，
        提取变更行前后各 50 行的上下文代码。

        所有文件上下文总计不超过 6000 字符，
        超过时优先保留有变更的行前后 50 行代码。
        如果获取文件内容失败，静默跳过（not critical）。
        """
        MAX_CONTEXT_CHARS = 6000
        CONTEXT_LINES = 50

        parts: List[str] = []
        total_chars = 0

        for f in diff_ctx.priority_files:
            fname = f.get("filename", "")
            patch = f.get("patch", "")
            if not fname or not patch:
                continue

            # 调用 GitHub API 获取 base 分支完整文件内容
            full_content = github_service.get_file_contents(
                owner=pr_info.owner,
                repo=pr_info.repo,
                path=fname,
                ref=pr_info.base_branch,
            )
            if not full_content:
                continue

            # 提取变更行前后各 CONTEXT_LINES 行的上下文
            context = self._extract_context(full_content, patch, CONTEXT_LINES)

            header = "#### 文件: {}".format(fname)
            footer = "\n以上为该文件的完整代码（含变更上下文）。请结合完整代码理解下文的 diff 变更。"
            block = "```\n完整代码（供理解改动上下文）:\n{}\n```{}".format(context, footer)
            candidate = "{}\n{}".format(header, block)

            if total_chars + len(candidate) > MAX_CONTEXT_CHARS:
                # 配额不足，尝试截断当前文件的内容
                remaining = MAX_CONTEXT_CHARS - total_chars
                min_overhead = len(header) + len(
                    "```\n完整代码（供理解改动上下文）:\n\n... (上下文已截断)\n```{}".format(footer)
                )
                if remaining < min_overhead:
                    break

                available_for_code = (
                    remaining
                    - len(header)
                    - len("```\n完整代码（供理解改动上下文）:\n\n```{}".format(footer))
                    - len("\n... (上下文已截断)")
                )
                if available_for_code > 0:
                    truncated_context = context[:available_for_code] + "\n... (上下文已截断)"
                    block = "```\n完整代码（供理解改动上下文）:\n{}\n```{}".format(
                        truncated_context, footer
                    )
                    parts.append("{}\n{}".format(header, block))
                break

            parts.append(candidate)
            total_chars += len(candidate)

        if not parts:
            return ""

        return "### 关键文件完整上下文\n\n{}\n\n".format("\n".join(parts))

    @staticmethod
    def _extract_context(file_content: str, patch: str, context_lines: int = 50) -> str:
        """从完整文件内容中提取变更行附近上下文。

        解析 unified diff 的 hunk header（@@ -old,count +new,count @@），
        确定变更在原文件中的行号范围，提取前后各 context_lines 行。
        多个 hunk 的范围自动合并去重。

        Parameters
        ----------
        file_content : str
            文件的完整内容。
        patch : str
            统一 diff 格式的 patch 文本。
        context_lines : int
            变更行前后各保留的行数。

        Returns
        -------
        str
            带行号标注的上下文字符串。
        """
        if not file_content:
            return ""

        file_lines = file_content.split("\n")
        total_lines = len(file_lines)

        # 解析 hunk header，提取变更在原文件中的行号范围
        hunk_pattern = re.compile(
            r"^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@"
        )
        ranges: List[Tuple[int, int]] = []
        for match in hunk_pattern.finditer(patch):
            old_start = int(match.group(1))
            old_count = int(match.group(2)) if match.group(2) else 1
            ranges.append((old_start, old_start + old_count - 1))

        if not ranges:
            # 无法解析行号，回退：返回前 200 行
            return "\n".join(
                "{:>6}| {}".format(i + 1, line)
                for i, line in enumerate(file_lines[:200])
            )

        # 合并重叠 / 相邻范围
        ranges.sort()
        merged: List[Tuple[int, int]] = []
        for r in ranges:
            if merged and r[0] <= merged[-1][1] + 1:
                merged[-1] = (merged[-1][0], max(merged[-1][1], r[1]))
            else:
                merged.append(r)

        # 扩展每个范围 ±context_lines
        expanded: List[Tuple[int, int]] = []
        for start, end in merged:
            ctx_start = max(1, start - context_lines)
            ctx_end = min(total_lines, end + context_lines)
            expanded.append((ctx_start, ctx_end))

        # 再次合并可能因扩展而重叠的范围
        final_ranges: List[Tuple[int, int]] = []
        for r in expanded:
            if final_ranges and r[0] <= final_ranges[-1][1] + 1:
                final_ranges[-1] = (final_ranges[-1][0], max(final_ranges[-1][1], r[1]))
            else:
                final_ranges.append(r)

        # 构建带行号的输出，范围之间插入省略标记
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


reviewer_service = ReviewerService()
