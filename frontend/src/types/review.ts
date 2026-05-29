/**
 * @file src/types/review.ts
 * @description AI PR Review 相关 TypeScript 类型定义
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

// ===== 响应类型 =====

/** 风险严重级别 */
export enum RiskSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

/** 建议分类标签 */
export enum SuggestionCategory {
  Performance = 'performance',
  Security = 'security',
  Maintainability = 'maintainability',
  Bug = 'bug',
  Style = 'style',
  BestPractice = 'best-practice',
  Other = 'other',
}

/** 风险项 */
export interface RiskItem {
  /** 风险等级 */
  severity: RiskSeverity;
  /** 风险标题 */
  title: string;
  /** 风险描述 */
  description: string;
  /** 涉及的文件路径 */
  filePath?: string;
  /** 行号范围 */
  lineRange?: string;
}

/** 建议项 */
export interface SuggestionItem {
  /** 建议分类 */
  category: SuggestionCategory;
  /** 建议标题 */
  title: string;
  /** 建议详情 */
  description: string;
  /** 示例代码（可选） */
  codeExample?: string;
  /** 涉及的文件路径 */
  filePath?: string;
}

/** PR 摘要 */
export interface PRSummary {
  /** 标题 */
  title: string;
  /** 描述简述 */
  description: string;
  /** 变更文件数 */
  filesChanged: number;
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
  /** 总风险数 */
  totalRisks: number;
  /** 总建议数 */
  totalSuggestions: number;
  /** 综合评分 (0-100) */
  score: number;
}

/** 分析成功响应 */
export interface AnalyzeSuccessResponse {
  success: true;
  /** PR 摘要 */
  summary: PRSummary;
  /** 风险项列表 */
  risks: RiskItem[];
  /** 建议列表 */
  suggestions: SuggestionItem[];
  /** 分析耗时（秒） */
  analysisTime?: number;
}

/** 分析失败响应 */
export interface AnalyzeErrorResponse {
  success: false;
  /** 错误消息 */
  error: string;
  /** 错误码 */
  code?: string;
}

/** 分析响应的联合类型 */
export type AnalyzeResponse = AnalyzeSuccessResponse | AnalyzeErrorResponse;

// ===== 组件内用到的展示枚举映射 =====

/** 风险级别的展示配置 */
export const RISK_SEVERITY_CONFIG: Record<RiskSeverity, {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}> = {
  [RiskSeverity.Critical]: {
    label: '严重',
    bgClass: 'bg-red-950/50',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/50',
  },
  [RiskSeverity.High]: {
    label: '高危',
    bgClass: 'bg-orange-950/50',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-500/50',
  },
  [RiskSeverity.Medium]: {
    label: '中等',
    bgClass: 'bg-yellow-950/50',
    textClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/50',
  },
  [RiskSeverity.Low]: {
    label: '低',
    bgClass: 'bg-green-950/50',
    textClass: 'text-green-400',
    borderClass: 'border-green-500/50',
  },
};

/** 建议分类的展示配置 */
export const SUGGESTION_CATEGORY_CONFIG: Record<SuggestionCategory, {
  label: string;
  bgClass: string;
  textClass: string;
}> = {
  [SuggestionCategory.Performance]: { label: '性能', bgClass: 'bg-violet-950/50', textClass: 'text-violet-400' },
  [SuggestionCategory.Security]: { label: '安全', bgClass: 'bg-red-950/50', textClass: 'text-red-400' },
  [SuggestionCategory.Maintainability]: { label: '可维护性', bgClass: 'bg-blue-950/50', textClass: 'text-blue-400' },
  [SuggestionCategory.Bug]: { label: '缺陷', bgClass: 'bg-orange-950/50', textClass: 'text-orange-400' },
  [SuggestionCategory.Style]: { label: '风格', bgClass: 'bg-teal-950/50', textClass: 'text-teal-400' },
  [SuggestionCategory.BestPractice]: { label: '最佳实践', bgClass: 'bg-emerald-950/50', textClass: 'text-emerald-400' },
  [SuggestionCategory.Other]: { label: '其他', bgClass: 'bg-slate-800', textClass: 'text-slate-400' },
};
