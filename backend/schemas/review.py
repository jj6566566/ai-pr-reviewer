from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    owner: str = Field(..., description="仓库所有者")
    repo: str = Field(..., description="仓库名称")
    pr_number: int = Field(..., description="PR 编号")


class FileInfo(BaseModel):
    filename: str
    status: str
    additions: int
    deletions: int
    patch: str


class PRInfoResponse(BaseModel):
    owner: str
    repo: str
    number: int
    title: str
    description: str
    author: str
    base_branch: str
    head_branch: str
    files_changed: int
    additions: int
    deletions: int
    files: list[FileInfo]
    diff_content: str


class RiskItem(BaseModel):
    severity: str
    file: str
    line: int
    description: str
    suggestion: str


class Suggestion(BaseModel):
    category: str
    description: str
    file: str
    code_snippet: str = ""


class AnalyzeResponse(BaseModel):
    pr_info: PRInfoResponse
    summary: str = ""
    risk_items: list[RiskItem] = []
    suggestions: list[Suggestion] = []
