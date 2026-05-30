export interface AnalyzeRequest {
  owner: string
  repo: string
  prNumber: number
  postComment?: boolean
}

export interface PRFile {
  filename: string
  status: "modified" | "added" | "removed"
  additions: number
  deletions: number
  patch: string
}

export interface PRInfo {
  owner: string
  repo: string
  number: number
  title: string
  description: string
  author: string
  base_branch: string
  head_branch: string
  files_changed: number
  additions: number
  deletions: number
  files: PRFile[]
  diff_content: string
}

export type RiskSeverity = "critical" | "high" | "medium" | "low"

export interface RiskItem {
  severity: RiskSeverity
  file: string
  line: number
  description: string
  suggestion: string
  confidence?: number
  is_false_positive?: boolean
}

export type SuggestionCategory = "security" | "performance" | "maintainability" | "best-practice" | "bug-risk"

export interface SuggestionItem {
  category: SuggestionCategory
  description: string
  file: string
  code_snippet: string
  confidence?: number
}

export type RiskLevel = "low" | "medium" | "high" | "critical"

export interface RuleMatch {
  rule_id: number
  rule_name: string
  severity: string
  file: string
  line: number
  matched_text: string
  suggestion: string | null
}

export interface AnalyzeResponse {
  pr_info: PRInfo
  summary: string
  risk_items: RiskItem[]
  suggestions: SuggestionItem[]
  rule_matches: RuleMatch[]
  risk_score: number
  risk_level: RiskLevel
  estimated_review_minutes: number
  analysis_id?: number
}

export interface AnalyzeSuccessResponse {
  success: true
  data: AnalyzeResponse
}

export interface AnalyzeErrorResponse {
  success: false
  error: string
}

export type AnalyzeResult = AnalyzeSuccessResponse | AnalyzeErrorResponse

export interface HistoryItem {
  id: number
  repo_owner: string
  repo_name: string
  pr_number: number
  pr_title: string
  author: string
  risk_score: number
  risk_level: RiskLevel
  files_changed: number
  status: string
  created_at: string
}

export interface HistoryDetail extends HistoryItem {
  summary: string
  risk_items: RiskItem[]
  suggestions: SuggestionItem[]
  pr_description: string
  base_branch: string
  head_branch: string
  additions: number
  deletions: number
  estimated_review_minutes: number
  feedback?: Record<string, { verdict: string; timestamp?: string | null }> | null
  confidence_scores?: Record<string, number> | null
  diff_content?: string | null
}

export interface CustomRule {
  id: number
  name: string
  description: string | null
  match_type: "text" | "regex" | "glob"
  match_pattern: string
  match_scope: "added_lines" | "context_lines" | "full_file"
  file_filter: string | null
  severity: "critical" | "high" | "medium" | "low"
  suggestion: string | null
  is_enabled: boolean
  is_preset: boolean
  created_at: string | null
  updated_at: string | null
}

export interface TrendDataPoint {
  day: string | null
  pr_count: number
  avg_risk_score: number
  total_files_changed: number
  total_additions: number
  total_deletions: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
}

export interface TrendSummary {
  total_prs: number
  avg_risk_score: number
  trend_direction: "improving" | "worsening" | "stable"
  most_common_severity: string
}

export interface TrendResponse {
  data_points: TrendDataPoint[]
  summary: TrendSummary
}

export interface BatchAnalyzeItem {
  owner: string
  repo: string
  pr_number: number
}

export interface BatchOverview {
  total_prs: number
  avg_risk_score: number
  highest_risk_pr: {
    pr_number: number
    title: string
    risk_score: number
    risk_level: RiskLevel
  } | null
  risk_distribution: Record<string, number>
  top_risks: string[]
}

export interface BatchAnalyzeResponse {
  results: AnalyzeResponse[]
  overview: BatchOverview
  duplicate_analysis?: CrossPRDuplicateResult | null
}

export interface CrossPRDuplicateResult {
  file_overlaps: FileOverlapItem[]
  similar_code_blocks: SimilarCodeBlockItem[]
  duplicate_risk_patterns: DuplicateRiskPatternItem[]
  summary: string
}

export interface FileOverlapItem {
  filename: string
  pr_numbers: number[]
  changes_detail: { pr_number: number; status: string; additions: number; deletions: number }[]
}

export interface SimilarCodeBlockItem {
  block_hash: string
  pr_numbers: number[]
  files: string[]
  similarity_score: number
  snippet_preview: string
}

export interface DuplicateRiskPatternItem {
  description: string
  affected_prs: number[]
  severity: string
  occurrence_count: number
}

export interface FeedbackItem {
  index: number
  verdict: "accepted" | "false_positive" | "helpful" | "not_helpful"
  category: "risk_item" | "suggestion"
}

export interface FeedbackRequest {
  items: FeedbackItem[]
}

export const RISK_SEVERITY_CONFIG: Record<RiskSeverity, { label: string; color: string; bgClass: string }> = {
  critical: { label: "致命", color: "#ef4444", bgClass: "bg-red-500/10 text-red-400 border-red-500/30" },
  high: { label: "高危", color: "#f59e0b", bgClass: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  medium: { label: "中等", color: "#3b82f6", bgClass: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  low: { label: "建议", color: "#06d6a0", bgClass: "bg-teal-500/10 text-teal-400 border-teal-500/30" },
}

export const SUGGESTION_CATEGORY_CONFIG: Record<SuggestionCategory, { label: string; icon: string }> = {
  security: { label: "安全", icon: "Shield" },
  performance: { label: "性能", icon: "Zap" },
  maintainability: { label: "可维护", icon: "Lightbulb" },
  "best-practice": { label: "最佳实践", icon: "Lightbulb" },
  "bug-risk": { label: "缺陷风险", icon: "Bug" },
}

export const SEVERITY_ORDER: Record<RiskSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export const RISK_LEVEL_CONFIG: Record<RiskLevel, { label: string; textClass: string; bgClass: string }> = {
  low: { label: "低风险", textClass: "text-emerald-400", bgClass: "bg-emerald-500/10" },
  medium: { label: "中风险", textClass: "text-yellow-400", bgClass: "bg-yellow-500/10" },
  high: { label: "高风险", textClass: "text-orange-400", bgClass: "bg-orange-500/10" },
  critical: { label: "严重风险", textClass: "text-red-400", bgClass: "bg-red-500/10" },
}
