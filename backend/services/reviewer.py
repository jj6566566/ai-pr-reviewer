import json
from typing import Optional

from backend.schemas.review import AnalyzeRequest, AnalyzeResponse, FileInfo, PRInfoResponse, RiskItem, Suggestion
from backend.services.github import PRInfo, github_service
from backend.services.llm import LLMClient, llm_client

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

        analysis = self._call_llm(pr_info)

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
        )

    def _call_llm(self, pr_info: PRInfo) -> dict:
        user_message = self._build_user_message(pr_info)

        raw = self.llm.chat(system_prompt=SYSTEM_PROMPT, user_message=user_message)

        return self._parse_response(raw)

    def _build_user_message(self, pr_info: PRInfo) -> str:
        file_list = "\n".join(
            f"  [{f.status}] {f.filename} (+{f.additions}/-{f.deletions})"
            for f in pr_info.files
        )

        diff = pr_info.diff_content
        max_diff_chars = 8000
        if len(diff) > max_diff_chars:
            diff = diff[:max_diff_chars] + "\n... (diff 已截断，共 {} 字符)".format(
                len(pr_info.diff_content)
            )

        return f"""请分析以下 Pull Request：

标题: {pr_info.title}
描述: {pr_info.description or "（无描述）"}
作者: {pr_info.author}
分支: {pr_info.head_branch} -> {pr_info.base_branch}
文件数: {pr_info.files_changed} | +{pr_info.additions}/-{pr_info.deletions}

改动的文件:
{file_list}

代码变更 (diff):
{diff}"""

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
