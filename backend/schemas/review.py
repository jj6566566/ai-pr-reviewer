from typing import Optional

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
    risk_score: int = 0
    """综合风险评分 0-100。"""
    risk_level: str = "low"
    """风险等级：low / medium / high / critical。"""
    estimated_review_minutes: int = 0
    """估算审查时间（分钟）。"""
    context_coverage: Optional[float] = None
    rule_matches: list["RuleMatch"] = []


class RuleMatch(BaseModel):
    rule_id: int
    rule_name: str
    severity: str
    file: str
    line: int
    matched_text: str
    suggestion: Optional[str] = None


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


class CustomRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    match_type: str = Field(..., pattern="^(text|regex|glob)$")
    match_pattern: str = Field(..., min_length=1)
    match_scope: str = Field("added_lines", pattern="^(added_lines|context_lines|full_file)$")
    file_filter: Optional[str] = Field(None)
    severity: str = Field("medium", pattern="^(critical|high|medium|low)$")
    suggestion: Optional[str] = Field(None, max_length=500)
    is_enabled: bool = True


class CustomRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    match_type: Optional[str] = Field(None, pattern="^(text|regex|glob)$")
    match_pattern: Optional[str] = Field(None, min_length=1)
    match_scope: Optional[str] = Field(None, pattern="^(added_lines|context_lines|full_file)$")
    file_filter: Optional[str] = Field(None)
    severity: Optional[str] = Field(None, pattern="^(critical|high|medium|low)$")
    suggestion: Optional[str] = Field(None, max_length=500)
    is_enabled: Optional[bool] = None


class CustomRuleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    match_type: str
    match_pattern: str
    match_scope: str
    file_filter: Optional[str] = None
    severity: str
    suggestion: Optional[str] = None
    is_enabled: bool
    is_preset: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class TrendDataPoint(BaseModel):
    day: Optional[str] = None
    pr_count: int = 0
    avg_risk_score: float = 0.0
    total_files_changed: int = 0
    total_additions: int = 0
    total_deletions: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0


class TrendSummary(BaseModel):
    total_prs: int = 0
    avg_risk_score: float = 0.0
    trend_direction: str = "stable"
    most_common_severity: str = "low"


class TrendResponse(BaseModel):
    data_points: list[TrendDataPoint] = []
    summary: TrendSummary
