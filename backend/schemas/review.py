from typing import Optional

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    owner: str = Field(..., description="仓库所有者")
    repo: str = Field(..., description="仓库名称")
    pr_number: int = Field(..., description="PR 编号")
    mode_id: Optional[int] = Field(None, description="评审模式 ID，不传使用默认模式")


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
    risk_score: int = 0
    """综合风险评分 0-100。"""
    risk_level: str = "low"
    """风险等级：low / medium / high / critical。"""
    estimated_review_minutes: int = 0
    """估算审查时间（分钟）。"""


class BatchAnalyzeItem(BaseModel):
    owner: str
    repo: str
    pr_number: int


class BatchAnalyzeRequest(BaseModel):
    prs: list[BatchAnalyzeItem]


class BatchRiskCard(BaseModel):
    pr_number: int
    title: str
    risk_score: int
    risk_level: str


class BatchOverview(BaseModel):
    total_prs: int
    avg_risk_score: float
    highest_risk_pr: Optional[BatchRiskCard]
    risk_distribution: dict
    top_risks: list[str]


class FileOverlapItem(BaseModel):
    filename: str
    pr_numbers: list[int]
    changes_detail: list[dict]


class SimilarCodeBlockItem(BaseModel):
    block_hash: str
    pr_numbers: list[int]
    files: list[str]
    similarity_score: float
    snippet_preview: str


class DuplicateRiskPatternItem(BaseModel):
    description: str
    affected_prs: list[int]
    severity: str
    occurrence_count: int


class CrossPRDuplicateResult(BaseModel):
    file_overlaps: list[FileOverlapItem]
    similar_code_blocks: list[SimilarCodeBlockItem]
    duplicate_risk_patterns: list[DuplicateRiskPatternItem]
    summary: str


class BatchAnalyzeResponse(BaseModel):
    results: list[AnalyzeResponse]
    overview: BatchOverview
    duplicate_analysis: Optional[CrossPRDuplicateResult] = None


class ReviewModeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    system_prompt: str = Field(..., min_length=1)
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)


class ReviewModeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    system_prompt: Optional[str] = Field(None, min_length=1)
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    sort_order: Optional[int] = None


class ReviewModeResponse(BaseModel):
    id: int
    name: str
    description: str
    system_prompt: str
    is_preset: bool
    temperature: float
    sort_order: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
