/**
 * @file src/types/review.ts
 * @description AI PR Review 相关 TypeScript 类型定义
 * 严格匹配后端 POST /api/review/analyze 返回的 JSON 结构
 */

// ===== 请求类型 =====

/** 分析请求参数 */
export interface AnalyzeRequest {
  /** GitHub 仓库所有者 */
  owner: string;
  /** GitHub 仓库名称 */
  repo: string;
  /** PR 编号 */
  prNumber: number;
}

// ===== 后端响应类型（与 JSON 结构一一对应） =====

/** PR 中单个文件变更信息 */
export interface PRFile {
  /** 文件路径 */
  filename: string;
  /** 变更状态 */
  status: 'modified' | 'added' | 'removed';
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
  /** diff patch 内容 */
  patch: string;
}

/** PR 基本信息 */
export interface PRInfo {
  /** 仓库所有者 */
  owner: string;
  /** 仓库名称 */
  repo: string;
  /** PR 编号 */
  number: number;
  /** PR 标题 */
  title: string;
  /** PR 描述 */
  description: string;
  /** 提交者 */
  author: string;
  /** 目标分支 */
  base_branch: string;
  /** 源分支 */
  head_branch: string;
  /** 变更文件数 */
  files_changed: number;
  /** 新增总行数 */
  additions: number;
  /** 删除总行数 */
  deletions: number;
  /** 变更文件列表 */
  files: PRFile[];
  /** 完整 diff 内容 */
  diff_content: string;
}

/** 风险严重级别 */
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

/** 风险项 */
export interface RiskItem {
  /** 风险等级 */
  severity: RiskSeverity;
  /** 涉及文件路径 */
  file: string;
  /** 行号 */
  line: number;
  /** 风险描述 */
  description: string;
  /** 修复建议 */
  suggestion: string;
}

/** 建议分类 */
export type SuggestionCategory =
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'best-practice'
  | 'bug-risk';

/** 建议项 */
export interface SuggestionItem {
  /** 建议分类 */
  category: SuggestionCategory;
  /** 建议描述 */
  description: string;
  /** 涉及文件路径 */
  file: string;
  /** 建议代码片段（可能为空字符串） */
  code_snippet: string;
}

/** 风险等级 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** 自定义规则匹配结果 */
export interface RuleMatch {
  rule_id: number;
  rule_name: string;
  severity: string;
  file: string;
  line: number;
  matched_text: string;
  suggestion: string | null;
}

/** 后端完整分析响应 */
export interface AnalyzeResponse {
  /** PR 基本信息 */
  pr_info: PRInfo;
  /** PR 变更摘要文本 */
  summary: string;
  /** 风险项列表 */
  risk_items: RiskItem[];
  /** 改进建议列表 */
  suggestions: SuggestionItem[];
  /** 自定义规则命中列表 */
  rule_matches: RuleMatch[];
  /** 综合风险分（0-100） */
  risk_score: number;
  /** 风险等级 */
  risk_level: RiskLevel;
  /** 估算审查时间（分钟） */
  estimated_review_minutes: number;
}

// ===== 批量分析类型 =====

export interface BatchAnalyzeItem {
  owner: string;
  repo: string;
  pr_number: number;
}

export interface BatchOverview {
  total_prs: number;
  avg_risk_score: number;
  highest_risk_pr: {
    pr_number: number;
    pr_title: string;
    risk_score: number;
    risk_level: RiskLevel;
  } | null;
  risk_distribution: Record<string, number>;
  top_risks: string[];
}

export interface BatchAnalyzeResponse {
  results: AnalyzeResponse[];
  overview: BatchOverview;
  duplicate_analysis?: CrossPRDuplicateResult | null;
}

export interface FileOverlapItem {
  filename: string;
  pr_numbers: number[];
  changes_detail: { pr_number: number; status: string; additions: number; deletions: number }[];
}

export interface SimilarCodeBlockItem {
  block_hash: string;
  pr_numbers: number[];
  files: string[];
  similarity_score: number;
  snippet_preview: string;
}

export interface DuplicateRiskPatternItem {
  description: string;
  affected_prs: number[];
  severity: string;
  occurrence_count: number;
}

export interface CrossPRDuplicateResult {
  file_overlaps: FileOverlapItem[];
  similar_code_blocks: SimilarCodeBlockItem[];
  duplicate_risk_patterns: DuplicateRiskPatternItem[];
  summary: string;
}

// ===== API 层适配类型 =====

/** 分析成功结果（API 层包装） */
export interface AnalyzeSuccessResponse {
  success: true;
  /** 后端原始数据 */
  data: AnalyzeResponse;
}

/** 分析失败结果 */
export interface AnalyzeErrorResponse {
  success: false;
  /** 错误消息 */
  error: string;
}

/** 分析结果联合类型 */
export type AnalyzeResult = AnalyzeSuccessResponse | AnalyzeErrorResponse;

// ===== 历史记录类型 =====

/** 历史记录列表项 */
export interface HistoryItem {
  id: number;
  repo_owner: string;
  repo_name: string;
  pr_number: number;
  pr_title: string;
  author: string;
  risk_score: number;
  risk_level: RiskLevel;
  files_changed: number;
  status: string;
  created_at: string;
}

/** 历史记录详情（含完整分析结果） */
export interface HistoryDetail extends HistoryItem {
  summary: string;
  risk_items: RiskItem[];
  suggestions: SuggestionItem[];
  pr_description: string;
  base_branch: string;
  head_branch: string;
  additions: number;
  deletions: number;
  estimated_review_minutes: number;
}

// ===== 展示配置 =====

/** 风险级别的展示配置 */
export const RISK_SEVERITY_CONFIG: Record<
  RiskSeverity,
  { label: string; bgClass: string; textClass: string; borderClass: string }
> = {
  critical: {
    label: '严重',
    bgClass: 'bg-red-950/50',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/50',
  },
  high: {
    label: '高危',
    bgClass: 'bg-orange-950/50',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-500/50',
  },
  medium: {
    label: '中等',
    bgClass: 'bg-yellow-950/50',
    textClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/50',
  },
  low: {
    label: '低',
    bgClass: 'bg-green-950/50',
    textClass: 'text-green-400',
    borderClass: 'border-green-500/50',
  },
};

/** 建议分类的展示配置 */
export const SUGGESTION_CATEGORY_CONFIG: Record<
  SuggestionCategory,
  { label: string; bgClass: string; textClass: string }
> = {
  security: {
    label: '安全',
    bgClass: 'bg-red-950/50',
    textClass: 'text-red-400',
  },
  performance: {
    label: '性能',
    bgClass: 'bg-violet-950/50',
    textClass: 'text-violet-400',
  },
  maintainability: {
    label: '可维护性',
    bgClass: 'bg-blue-950/50',
    textClass: 'text-blue-400',
  },
  'best-practice': {
    label: '最佳实践',
    bgClass: 'bg-emerald-950/50',
    textClass: 'text-emerald-400',
  },
  'bug-risk': {
    label: '缺陷风险',
    bgClass: 'bg-orange-950/50',
    textClass: 'text-orange-400',
  },
};

/** 风险严重程度排序权重 */
export const SEVERITY_ORDER: Record<RiskSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** 风险评分展示配置（颜色 + 中文标签） */
export const RISK_LEVEL_SCORE_CONFIG: Record<
  RiskLevel,
  { label: string; textClass: string; bgClass: string; ringClass: string }
> = {
  low: {
    label: '低风险',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    ringClass: 'ring-emerald-500/30',
  },
  medium: {
    label: '中风险',
    textClass: 'text-yellow-400',
    bgClass: 'bg-yellow-500/10',
    ringClass: 'ring-yellow-500/30',
  },
  high: {
    label: '高风险',
    textClass: 'text-orange-400',
    bgClass: 'bg-orange-500/10',
    ringClass: 'ring-orange-500/30',
  },
  critical: {
    label: '严重风险',
    textClass: 'text-red-400',
    bgClass: 'bg-red-500/10',
    ringClass: 'ring-red-500/30',
  },
};

export interface CustomRule {
  id: number;
  name: string;
  description: string | null;
  match_type: 'text' | 'regex' | 'glob';
  match_pattern: string;
  match_scope: 'added_lines' | 'context_lines' | 'full_file';
  file_filter: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestion: string | null;
  is_enabled: boolean;
  is_preset: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface TrendDataPoint {
  day: string | null;
  pr_count: number;
  avg_risk_score: number;
  total_files_changed: number;
  total_additions: number;
  total_deletions: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

export interface TrendSummary {
  total_prs: number;
  avg_risk_score: number;
  trend_direction: 'improving' | 'worsening' | 'stable';
  most_common_severity: string;
}

export interface TrendResponse {
  data_points: TrendDataPoint[];
  summary: TrendSummary;
}
