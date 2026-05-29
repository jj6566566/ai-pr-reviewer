/**
 * @file src/pages/Dashboard.tsx
 * @description AI PR Review 仪表盘主页面
 * 提供 PR 输入、分析触发、结果展示（摘要/风险/建议）完整交互流程
 */

import { useState, useMemo, useEffect, useCallback, type FormEvent } from 'react';
import {
  GitPullRequest,
  Loader2,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  ShieldCheck,
  FileCode2,
  Search,
  GitBranch,
  MapPin,
  History,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  X,
  Plus,
  BarChart3,
  Activity,
  Gauge,
  Zap,
  Layers,
  GitMerge,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  analyzePR,
  fetchHistory,
  fetchHistoryDetail,
  analyzeBatch,
  fetchRules,
  createRule,
  updateRule,
  deleteRule,
} from '../api/review';
import type {
  AnalyzeResponse,
  RiskItem,
  SuggestionItem,
  SuggestionCategory,
  HistoryItem,
  HistoryDetail,
  BatchAnalyzeItem,
  BatchAnalyzeResponse,
  RiskLevel,
  CrossPRDuplicateResult,
  RiskSeverity,
  CustomRule,
  RuleMatch,
} from '../types/review';
import {
  RISK_SEVERITY_CONFIG,
  SUGGESTION_CATEGORY_CONFIG,
  SEVERITY_ORDER,
  RISK_LEVEL_SCORE_CONFIG,
} from '../types/review';

// ===== 页面状态类型 =====

type PageStatus = 'idle' | 'loading' | 'success' | 'error';

type DashboardMode = 'single' | 'batch' | 'rules';

// ===== 子组件 =====

/** 页头品牌区域 */
function BrandHeader() {
  return (
    <header className="text-center mb-10 pt-8">
      <div className="inline-flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
          <GitPullRequest className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-sky-400">AI</span>
          <span className="text-slate-200"> PR Review</span>
        </h1>
      </div>
      <p className="text-slate-400 text-sm max-w-md mx-auto">
        智能化代码审查，自动识别潜在风险与改进建议
      </p>
    </header>
  );
}

/** 输入表单区域 Props */
interface InputFormProps {
  onSubmit: (owner: string, repo: string, prNumber: number) => void;
  isLoading: boolean;
}

/** 输入表单区域 */
function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [prNumber, setPrNumber] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedOwner = owner.trim();
    const trimmedRepo = repo.trim();
    const num = parseInt(prNumber, 10);

    if (!trimmedOwner || !trimmedRepo || !prNumber || isNaN(num) || num <= 0) {
      return;
    }

    onSubmit(trimmedOwner, trimmedRepo, num);
  };

  const isFormValid =
    owner.trim() !== '' &&
    repo.trim() !== '' &&
    prNumber.trim() !== '' &&
    parseInt(prNumber, 10) > 0;

  const inputBaseClass =
    'w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 focus:bg-slate-800/80';

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto mb-10">
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        {/* Owner */}
        <div className="flex-1 relative">
          <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="仓库所有者 (owner)"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            disabled={isLoading}
            className={`${inputBaseClass} pl-9`}
          />
        </div>

        {/* Repo */}
        <div className="flex-1 relative">
          <FileCode2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="仓库名称 (repo)"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            disabled={isLoading}
            className={`${inputBaseClass} pl-9`}
          />
        </div>

        {/* PR Number */}
        <div className="w-32 sm:w-36 relative">
          <GitPullRequest className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="number"
            min="1"
            placeholder="PR #"
            value={prNumber}
            onChange={(e) => setPrNumber(e.target.value)}
            disabled={isLoading}
            className={`${inputBaseClass} pl-9`}
          />
        </div>
      </div>

      {/* 提交按钮 */}
      <button
        type="submit"
        disabled={!isFormValid || isLoading}
        className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200
          bg-gradient-to-r from-sky-500 to-violet-500 text-white
          hover:from-sky-400 hover:to-violet-400
          active:scale-[0.98]
          shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30
          disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            分析中...
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            开始分析
          </>
        )}
      </button>
    </form>
  );
}

interface BatchInputFormProps {
  onSubmit: (prs: BatchAnalyzeItem[]) => void;
  isLoading: boolean;
}

function BatchInputForm({ onSubmit, isLoading }: BatchInputFormProps) {
  const [prs, setPrs] = useState<BatchAnalyzeItem[]>([
    { owner: '', repo: '', pr_number: 0 },
    { owner: '', repo: '', pr_number: 0 },
  ]);

  const handleFieldChange = (
    index: number,
    field: keyof BatchAnalyzeItem,
    value: string,
  ) => {
    setPrs((prev) => {
      const next = [...prev];
      if (field === 'pr_number') {
        next[index] = { ...next[index], [field]: parseInt(value, 10) || 0 };
      } else {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  const handleRemove = (index: number) => {
    if (prs.length <= 2) return;
    setPrs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (prs.length >= 10) return;
    setPrs((prev) => [...prev, { owner: '', repo: '', pr_number: 0 }]);
  };

  const isValid = prs.every(
    (p) =>
      p.owner.trim() !== '' &&
      p.repo.trim() !== '' &&
      p.pr_number > 0,
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValid || prs.length < 2) return;
    const cleaned = prs.map((p) => ({
      owner: p.owner.trim(),
      repo: p.repo.trim(),
      pr_number: p.pr_number,
    }));
    onSubmit(cleaned);
  };

  const inputBaseClass =
    'w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 focus:bg-slate-800/80';

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto mb-10">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-5 h-5 text-violet-400" />
        <h2 className="text-lg font-semibold text-slate-200">批量分析</h2>
        <span className="text-xs text-slate-500 ml-auto">{prs.length}/10 PR</span>
      </div>

      <div className="space-y-2 mb-4">
        {prs.map((pr, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 transition-colors hover:border-slate-600/50"
          >
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[11px] font-semibold text-slate-500 min-w-[28px]">
                PR {idx + 1}
              </span>
              {prs.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="ml-auto p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                  title="移除"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="owner"
                  value={pr.owner}
                  onChange={(e) => handleFieldChange(idx, 'owner', e.target.value)}
                  disabled={isLoading}
                  className={inputBaseClass}
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="repo"
                  value={pr.repo}
                  onChange={(e) => handleFieldChange(idx, 'repo', e.target.value)}
                  disabled={isLoading}
                  className={inputBaseClass}
                />
              </div>
              <div className="w-28 sm:w-32">
                <input
                  type="number"
                  min="1"
                  placeholder="#"
                  value={pr.pr_number > 0 ? pr.pr_number : ''}
                  onChange={(e) => handleFieldChange(idx, 'pr_number', e.target.value)}
                  disabled={isLoading}
                  className={inputBaseClass}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={prs.length >= 10 || isLoading}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 border border-dashed border-slate-600/50 text-slate-400 text-sm hover:border-sky-500/40 hover:text-sky-400 transition-all duration-200 mb-3 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Plus className="w-4 h-4" />
        添加 PR
      </button>

      <button
        type="submit"
        disabled={!isValid || prs.length < 2 || isLoading}
        className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200
          bg-gradient-to-r from-sky-500 to-violet-500 text-white
          hover:from-sky-400 hover:to-violet-400
          active:scale-[0.98]
          shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30
          disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            批量分析中...
          </>
        ) : (
          <>
            <BarChart3 className="w-4 h-4" />
            开始批量分析
          </>
        )}
      </button>
    </form>
  );
}

/** Loading 状态展示 */
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-sky-400 animate-spin" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-sky-500/30 animate-ping" />
      </div>
      <p className="text-slate-400 text-sm font-medium">AI 正在分析 PR...</p>
      <p className="text-slate-500 text-xs mt-1.5">这可能需要几秒钟</p>
    </div>
  );
}

/** 错误状态展示 Props */
interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

/** 错误状态展示 */
function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="max-w-lg mx-auto mt-10">
      <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="text-red-400 font-semibold mb-2">分析失败</h3>
        <p className="text-slate-400 text-sm leading-relaxed mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          重试
        </button>
      </div>
    </div>
  );
}

/** 结果展示区域 Props */
interface ResultSectionProps {
  data: AnalyzeResponse;
  onReset: () => void;
}

/** 统计指标小方块 */
function StatItem({
  label,
  value,
  color = 'text-slate-300',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700/40 px-3 py-2.5 text-center">
      <p className={`text-lg font-bold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

/** PR 摘要卡片 */
function SummaryCard({ data }: { data: AnalyzeResponse }) {
  const { pr_info, summary } = data;
  const riskCount = data.risk_items.length;
  const suggestionCount = data.suggestions.length;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <FileCode2 className="w-5 h-5 text-sky-400" />
        PR 摘要
      </h2>

      {/* PR 标题 */}
      <div className="mb-5">
        <h3 className="text-lg font-bold text-white leading-snug">
          {pr_info.title}
        </h3>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
          <span>
            {pr_info.owner}/{pr_info.repo}#{pr_info.number}
          </span>
          <span className="text-slate-600">|</span>
          <span>{pr_info.author}</span>
          <span className="text-slate-600">|</span>
          <span>
            {pr_info.base_branch} &larr; {pr_info.head_branch}
          </span>
        </p>
      </div>

      {/* 摘要文本 */}
      <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-4 mb-5">
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {summary}
        </p>
      </div>

      {/* 风险评分 */}
      {(() => {
        const scoreConfig = RISK_LEVEL_SCORE_CONFIG[data.risk_level];
        return (
          <div className="flex items-center gap-4 mb-5">
            {/* 左侧：风险分大数字 */}
            <div
              className={`flex-shrink-0 w-16 h-16 rounded-full ring-2 ${scoreConfig.ringClass} ${scoreConfig.bgClass} flex items-center justify-center`}
            >
              <span className={`text-2xl font-extrabold ${scoreConfig.textClass}`}>
                {data.risk_score}
              </span>
            </div>

            {/* 右侧：风险等级 + 审查时间 */}
            <div className="flex flex-col gap-0.5">
              <span className={`text-sm font-semibold ${scoreConfig.textClass}`}>
                {scoreConfig.label}
              </span>
              <span className="text-xs text-slate-500">
                预计审查: ~{data.estimated_review_minutes} 分钟
              </span>
            </div>
          </div>
        );
      })()}

      {/* 统计指标 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatItem label="变更文件" value={pr_info.files_changed} />
        <StatItem label="新增行" value={pr_info.additions} color="text-emerald-400" />
        <StatItem label="删除行" value={pr_info.deletions} color="text-red-400" />
        <StatItem label="风险项" value={riskCount} color="text-orange-400" />
        <StatItem label="建议" value={suggestionCount} color="text-sky-400" />
      </div>
    </div>
  );
}

/** 风险列表 */
function RiskList({ riskItems }: { riskItems: RiskItem[] }) {
  // 按严重程度排序：critical > high > medium > low
  const sorted = useMemo(
    () =>
      [...riskItems].sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99),
      ),
    [riskItems],
  );

  if (riskItems.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-emerald-400" />
          风险项
        </h2>
        <p className="text-sm text-emerald-400/80">未发现风险项，代码质量良好</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-orange-400" />
        风险项
        <span className="text-xs text-slate-500 ml-auto">共 {riskItems.length} 项</span>
      </h2>

      <div className="space-y-3">
        {sorted.map((risk, idx) => {
          const config = RISK_SEVERITY_CONFIG[risk.severity];
          return (
            <div
              key={idx}
              className={`rounded-lg border-l-2 ${config.borderClass} ${config.bgClass} p-4 transition-colors`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${config.textClass} bg-slate-900/40 whitespace-nowrap mt-0.5`}
                >
                  {config.label}
                </span>
                <div className="flex-1 min-w-0">
                  {/* 文件路径 + 行号 */}
                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-1.5">
                    <FileCode2 className="w-3 h-3" />
                    {risk.file}
                    {risk.line > 0 && (
                      <>
                        <MapPin className="w-3 h-3 ml-1" />
                        <span className="text-slate-600">L{risk.line}</span>
                      </>
                    )}
                  </p>

                  {/* 风险描述 */}
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {risk.description}
                  </p>

                  {/* 修复建议 */}
                  {risk.suggestion && (
                    <div className="mt-2 rounded-md bg-slate-900/60 border border-slate-700/40 p-3">
                      <p className="text-[11px] font-semibold text-sky-400 uppercase tracking-wide mb-1">
                        修复建议
                      </p>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        {risk.suggestion}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 按 category 分组建议 */
function groupSuggestionsByCategory(
  suggestions: SuggestionItem[],
): Map<SuggestionCategory, SuggestionItem[]> {
  const groups = new Map<SuggestionCategory, SuggestionItem[]>();
  for (const s of suggestions) {
    const list = groups.get(s.category);
    if (list) {
      list.push(s);
    } else {
      groups.set(s.category, [s]);
    }
  }
  return groups;
}

/** 建议列表 */
function SuggestionList({ suggestions }: { suggestions: SuggestionItem[] }) {
  // 按 category 分组
  const groups = useMemo(() => groupSuggestionsByCategory(suggestions), [suggestions]);

  if (suggestions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-emerald-400" />
          改进建议
        </h2>
        <p className="text-sm text-emerald-400/80">暂无改进建议</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-yellow-400" />
        改进建议
        <span className="text-xs text-slate-500 ml-auto">共 {suggestions.length} 条</span>
      </h2>

      <div className="space-y-5">
        {Array.from(groups.entries()).map(([category, items]) => {
          const catConfig = SUGGESTION_CATEGORY_CONFIG[category];
          return (
            <div key={category}>
              {/* 分组标题 */}
              <div className="flex items-center gap-2 mb-2.5">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold ${catConfig.textClass} ${catConfig.bgClass}`}
                >
                  {catConfig.label}
                </span>
                <span className="text-[11px] text-slate-500">
                  {items.length} 条
                </span>
              </div>

              {/* 分组内的建议项 */}
              <div className="space-y-3">
                {items.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg bg-slate-800/50 border border-slate-700/40 p-4 transition-colors hover:border-slate-600/50"
                  >
                    {/* 文件路径 */}
                    {suggestion.file && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                        <FileCode2 className="w-3 h-3" />
                        {suggestion.file}
                      </p>
                    )}

                    {/* 建议描述 */}
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {suggestion.description}
                    </p>

                    {/* 代码片段 */}
                    {suggestion.code_snippet && (
                      <pre className="mt-3 rounded-md bg-slate-900/80 border border-slate-700/50 p-3 text-xs text-slate-300 overflow-x-auto">
                        <code>{suggestion.code_snippet}</code>
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 重置按钮 */
function ResetBar({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex justify-center mt-4 mb-10">
      <button
        onClick={onReset}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        分析另一个 PR
      </button>
    </div>
  );
}

/** 结果展示区 */
function ResultSection({ data, onReset }: ResultSectionProps) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* 成功标记 */}
      <div className="flex items-center justify-center gap-2 mb-6 text-sm text-emerald-400">
        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <span className="text-[10px] font-bold">&#10003;</span>
        </div>
        分析完成
      </div>

      <SummaryCard data={data} />
      <RiskList riskItems={data.risk_items} />
      <RuleMatchesView ruleMatches={data.rule_matches} />
      <SuggestionList suggestions={data.suggestions} />
      <ResetBar onReset={onReset} />
    </div>
  );
}

function getRiskLevelColor(level: string): string {
  switch (level) {
    case 'critical':
      return 'bg-red-400';
    case 'high':
      return 'bg-orange-400';
    case 'medium':
      return 'bg-yellow-400';
    case 'low':
      return 'bg-green-400';
    default:
      return 'bg-slate-400';
  }
}

function getRiskLevelTextColor(level: string): string {
  switch (level) {
    case 'critical':
      return 'text-red-400';
    case 'high':
      return 'text-orange-400';
    case 'medium':
      return 'text-yellow-400';
    case 'low':
      return 'text-green-400';
    default:
      return 'text-slate-400';
  }
}

function getRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

interface BatchResultViewProps {
  data: BatchAnalyzeResponse;
  onReset: () => void;
}

function BatchResultView({ data, onReset }: BatchResultViewProps) {
  const { overview, results } = data;
  const [expandedPrs, setExpandedPrs] = useState<Set<number>>(new Set());

  const toggleExpand = (idx: number) => {
    setExpandedPrs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const avgRiskLevel = getRiskLevelFromScore(overview.avg_risk_score);
  const avgScoreConfig = RISK_LEVEL_SCORE_CONFIG[avgRiskLevel];

  const sortedResults = useMemo(
    () => [...results].sort((a, b) => b.risk_score - a.risk_score),
    [results],
  );

  const maxScore = 100;

  const distributionEntries = useMemo(() => {
    const total = overview.total_prs || 1;
    return Object.entries(overview.risk_distribution)
      .sort(([, a], [, b]) => b - a)
      .map(([level, count]) => ({ level, count, pct: Math.round((count / total) * 100) }));
  }, [overview.risk_distribution, overview.total_prs]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-center gap-2 mb-6 text-sm text-emerald-400">
        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <span className="text-[10px] font-bold">&#10003;</span>
        </div>
        批量分析完成（共 {results.length} 个 PR）
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              平均风险分
            </span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className={`text-3xl font-extrabold ${avgScoreConfig.textClass}`}>
              {Math.round(overview.avg_risk_score)}
            </span>
            <span className="text-sm text-slate-500">/100</span>
          </div>
          <span className={`text-xs font-semibold ${avgScoreConfig.textClass}`}>
            {avgScoreConfig.label}
          </span>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              最高风险 PR
            </span>
          </div>
          {overview.highest_risk_pr ? (
            <>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-lg font-bold text-slate-200">
                  #{overview.highest_risk_pr.pr_number}
                </span>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${RISK_LEVEL_SCORE_CONFIG[overview.highest_risk_pr.risk_level]?.bgClass ?? 'bg-slate-800'} ${getRiskLevelTextColor(overview.highest_risk_pr.risk_level)}`}>
                  {RISK_LEVEL_SCORE_CONFIG[overview.highest_risk_pr.risk_level]?.label ?? overview.highest_risk_pr.risk_level}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                {overview.highest_risk_pr.pr_title}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">--</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              风险分布
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {distributionEntries.length > 0 ? (
              distributionEntries.map(({ level, count, pct }) => (
                <div key={level} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-sm ${getRiskLevelColor(level)}`} />
                  <span className="text-xs text-slate-300 font-medium">{count}</span>
                  <span className="text-[10px] text-slate-500">{pct}%</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">--</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-5 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-sky-400" />
          风险评分对比
        </h2>

        <div className="space-y-3">
          {sortedResults.map((result) => {
            const scoreConfig = RISK_LEVEL_SCORE_CONFIG[result.risk_level];
            const barWidth = Math.max((result.risk_score / maxScore) * 100, 2);
            return (
              <div key={result.pr_info.number} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-48 sm:w-56 flex-shrink-0 min-w-0">
                  <span className="text-xs font-mono font-semibold text-slate-500 whitespace-nowrap">
                    #{result.pr_info.number}
                  </span>
                  <span className="text-xs text-slate-400 truncate">
                    {result.pr_info.title}
                  </span>
                </div>
                <div className="flex-1 h-6 bg-slate-700/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${getRiskLevelColor(result.risk_level)}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 w-20 justify-end">
                  <span className={`text-sm font-bold ${scoreConfig.textClass}`}>
                    {result.risk_score}
                  </span>
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${scoreConfig.bgClass} ${scoreConfig.textClass}`}>
                    {scoreConfig.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {overview.top_risks.length > 0 && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            常见风险项
          </h2>
          <div className="space-y-2">
            {overview.top_risks.map((risk, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 rounded-lg bg-slate-800/50 border border-slate-700/40 px-3 py-2.5"
              >
                <span className="text-[11px] font-bold text-slate-600 min-w-[18px] mt-0.5">
                  {idx + 1}.
                </span>
                <span className="text-sm text-slate-300 leading-relaxed">{risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.duplicate_analysis && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-sky-400" />
            跨PR重复检测
          </h2>

          {data.duplicate_analysis.summary && (
            <p className="text-sm text-sky-400 mb-4 font-medium">
              {data.duplicate_analysis.summary}
            </p>
          )}

          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              文件重叠
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-700/60 text-slate-300">
                {data.duplicate_analysis.file_overlaps.length}
              </span>
            </h3>
            {data.duplicate_analysis.file_overlaps.length === 0 ? (
              <p className="text-sm text-slate-500">未发现文件重叠</p>
            ) : (
              <div className="space-y-2">
                {data.duplicate_analysis.file_overlaps.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg bg-slate-800/50 border border-slate-700/40 px-3 py-2.5"
                  >
                    <span className="text-sm text-slate-200 truncate flex-1 min-w-0">
                      {item.filename}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {item.pr_numbers.map((pr) => (
                        <span
                          key={pr}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-violet-950/50 text-violet-400 border border-violet-500/30"
                        >
                          #{pr}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              相似代码片段
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-700/60 text-slate-300">
                {data.duplicate_analysis.similar_code_blocks.length}
              </span>
            </h3>
            {data.duplicate_analysis.similar_code_blocks.length === 0 ? (
              <p className="text-sm text-slate-500">未发现相似代码片段</p>
            ) : (
              <div className="space-y-3">
                {data.duplicate_analysis.similar_code_blocks.map((block, idx) => {
                  const scoreColor =
                    block.similarity_score >= 90
                      ? 'text-red-400'
                      : block.similarity_score >= 80
                        ? 'text-orange-400'
                        : 'text-yellow-400';
                  return (
                    <div
                      key={idx}
                      className="rounded-lg bg-slate-800/50 border border-slate-700/40 p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-bold ${scoreColor}`}>
                          {block.similarity_score}%
                        </span>
                        <span className="text-xs text-slate-500 truncate">
                          {block.files.join(', ')}
                        </span>
                        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                          {block.pr_numbers.map((pr) => (
                            <span
                              key={pr}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-violet-950/50 text-violet-400 border border-violet-500/30"
                            >
                              #{pr}
                            </span>
                          ))}
                        </div>
                      </div>
                      {block.snippet_preview && (
                        <pre className="text-xs text-slate-400 bg-slate-900/60 rounded p-2 overflow-x-auto">
                          <code>{block.snippet_preview}</code>
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              重复风险模式
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-700/60 text-slate-300">
                {data.duplicate_analysis.duplicate_risk_patterns.length}
              </span>
            </h3>
            {data.duplicate_analysis.duplicate_risk_patterns.length === 0 ? (
              <p className="text-sm text-slate-500">未发现重复风险模式</p>
            ) : (
              <div className="space-y-2">
                {data.duplicate_analysis.duplicate_risk_patterns.map((pattern, idx) => {
                  const severityKey = pattern.severity as RiskSeverity;
                  const severityConfig =
                    RISK_SEVERITY_CONFIG[severityKey] ?? RISK_SEVERITY_CONFIG.medium;
                  return (
                    <div
                      key={idx}
                      className="rounded-lg bg-slate-800/50 border border-slate-700/40 p-3"
                    >
                      <div className="flex items-start gap-2 mb-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${severityConfig.bgClass} ${severityConfig.textClass} whitespace-nowrap mt-0.5`}
                        >
                          {severityConfig.label}
                        </span>
                        <span className="text-sm text-slate-200">{pattern.description}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>
                          涉及 PR:{' '}
                          {pattern.affected_prs.map((p) => `#${p}`).join(', ')}
                        </span>
                        <span>出现 {pattern.occurrence_count} 次</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <GitPullRequest className="w-5 h-5 text-violet-400" />
          各 PR 分析结果
        </h2>

        <div className="space-y-3">
          {sortedResults.map((result, idx) => {
            const scoreConfig = RISK_LEVEL_SCORE_CONFIG[result.risk_level];
            const isExpanded = expandedPrs.has(idx);
            return (
              <div
                key={result.pr_info.number}
                className="rounded-lg border border-slate-700/40 bg-slate-800/50 overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(idx)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/70 transition-colors"
                >
                  <span className="text-xs font-mono font-semibold text-slate-500 whitespace-nowrap">
                    #{result.pr_info.number}
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-200 truncate">
                    {result.pr_info.title}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${scoreConfig.bgClass} ${scoreConfig.textClass}`}>
                    {result.risk_score}
                  </span>
                  <span className={`text-[11px] font-semibold ${scoreConfig.textClass}`}>
                    {scoreConfig.label}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-700/40 px-4 pb-4 pt-3">
                    <SummaryCard data={result} />
                    <RiskList riskItems={result.risk_items} />
                    <SuggestionList suggestions={result.suggestions} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center mt-4 mb-10">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          重新批量分析
        </button>
      </div>
    </div>
  );
}

const RULE_MATCH_TYPE_LABELS: Record<string, string> = {
  text: '纯文本',
  regex: '正则',
  glob: 'Glob',
};

const RULE_SCOPE_LABELS: Record<string, string> = {
  added_lines: '仅新增行',
  context_lines: '上下文行',
  full_file: '全文件',
};

const emptyRuleForm = {
  name: '',
  description: '',
  match_type: 'text' as const,
  match_pattern: '',
  match_scope: 'added_lines' as const,
  file_filter: '',
  severity: 'medium' as const,
  suggestion: '',
  is_enabled: true,
};

function CustomRulesPanel() {
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRule, setEditingRule] = useState<CustomRule | null>(null);
  const [form, setForm] = useState({ ...emptyRuleForm });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError('');
    try {
      const data = await fetchRules();
      setRules(data);
    } catch (err: unknown) {
      setRulesError(err instanceof Error ? err.message : '加载规则失败');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const presetRules = useMemo(() => rules.filter((r) => r.is_preset), [rules]);
  const customRules = useMemo(() => rules.filter((r) => !r.is_preset), [rules]);

  const resetForm = () => {
    setForm({ ...emptyRuleForm });
    setShowCreateForm(false);
    setEditingRule(null);
    setFormError('');
  };

  const handleCreateClick = () => {
    resetForm();
    setShowCreateForm(true);
  };

  const handleEditClick = (rule: CustomRule) => {
    setForm({
      name: rule.name,
      description: rule.description || '',
      match_type: rule.match_type,
      match_pattern: rule.match_pattern,
      match_scope: rule.match_scope,
      file_filter: rule.file_filter || '',
      severity: rule.severity,
      suggestion: rule.suggestion || '',
      is_enabled: rule.is_enabled,
    });
    setEditingRule(rule);
    setShowCreateForm(true);
    setFormError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.match_pattern.trim()) {
      setFormError('名称和匹配模式为必填项');
      return;
    }
    setFormSubmitting(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        match_type: form.match_type,
        match_pattern: form.match_pattern.trim(),
        match_scope: form.match_scope,
        file_filter: form.file_filter.trim() || null,
        severity: form.severity,
        suggestion: form.suggestion.trim() || null,
        is_enabled: form.is_enabled,
      };
      if (editingRule) {
        await updateRule(editingRule.id, payload);
      } else {
        await createRule(payload as Omit<CustomRule, 'id' | 'created_at' | 'updated_at'>);
      }
      resetForm();
      await loadRules();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteRule(id);
      await loadRules();
    } catch (err: unknown) {
      setRulesError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (rule: CustomRule) => {
    const prevEnabled = rule.is_enabled;
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_enabled: !r.is_enabled } : r))
    );
    try {
      await updateRule(rule.id, { is_enabled: !prevEnabled });
    } catch {
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_enabled: prevEnabled } : r))
      );
    }
  };

  const inputClass =
    'w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30';

  const selectClass =
    'bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none transition-all duration-200 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30';

  const severityOptions: { value: string; label: string }[] = [
    { value: 'critical', label: '严重' },
    { value: 'high', label: '高危' },
    { value: 'medium', label: '中等' },
    { value: 'low', label: '低' },
  ];

  const renderRuleCard = (rule: CustomRule) => {
    const sevConfig = RISK_SEVERITY_CONFIG[rule.severity as RiskSeverity] ?? RISK_SEVERITY_CONFIG.medium;
    const isDeleting = deletingId === rule.id;

    return (
      <div
        key={rule.id}
        className={`rounded-lg border ${sevConfig.borderClass} ${sevConfig.bgClass} p-4 transition-colors`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${sevConfig.textClass} bg-slate-900/40`}
              >
                {sevConfig.label}
              </span>
              <span className="text-sm font-semibold text-slate-200 truncate">
                {rule.name}
              </span>
              {rule.is_preset && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-950/60 text-violet-400 border border-violet-500/30">
                  预设
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle(rule);
                }}
                className={`inline-flex items-center gap-1 text-[11px] ml-auto px-2 py-1 rounded-md transition-colors ${
                  rule.is_enabled
                    ? 'text-emerald-400 hover:bg-emerald-950/30'
                    : 'text-slate-500 hover:bg-slate-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    rule.is_enabled ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                />
                {rule.is_enabled ? '已启用' : '已禁用'}
              </button>
            </div>

            {rule.description && (
              <p className="text-xs text-slate-400 mb-2 leading-relaxed">
                {rule.description}
              </p>
            )}

            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-600">匹配:</span>
                <code className="text-sky-400/80 bg-slate-900/50 px-1 rounded">
                  {rule.match_pattern}
                </code>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                {RULE_MATCH_TYPE_LABELS[rule.match_type] ?? rule.match_type}
              </span>
              <span className="text-slate-600">|</span>
              <span>
                {RULE_SCOPE_LABELS[rule.match_scope] ?? rule.match_scope}
              </span>
              {rule.file_filter && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-500 truncate max-w-[160px]">
                    {rule.file_filter}
                  </span>
                </>
              )}
            </div>
          </div>

          {!rule.is_preset && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleEditClick(rule)}
                className="p-1.5 rounded-md text-slate-500 hover:text-sky-400 hover:bg-sky-950/30 transition-colors"
                title="编辑"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(rule.id)}
                disabled={isDeleting}
                className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-40"
                title="删除"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto mb-10">
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-violet-400" />
            自定义规则管理
          </h2>
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-violet-500 text-white text-xs font-semibold hover:from-sky-400 hover:to-violet-400 transition-all duration-200 shadow-lg shadow-sky-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            创建规则
          </button>
        </div>

        {rulesLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
            <span className="ml-2 text-sm text-slate-400">加载规则中...</span>
          </div>
        )}

        {rulesError && (
          <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-4 text-center mb-4">
            <p className="text-sm text-red-400 mb-3">{rulesError}</p>
            <button
              onClick={loadRules}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
            >
              <Search className="w-3 h-3" />
              重试
            </button>
          </div>
        )}

        {!rulesLoading && !rulesError && (
          <>
            {presetRules.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-violet-400" />
                  预设规则（不可删除）
                  <span className="text-xs text-slate-600 ml-1">
                    {presetRules.length} 条
                  </span>
                </h3>
                <div className="space-y-3">
                  {presetRules.map(renderRuleCard)}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-sky-400" />
                自定义规则
                <span className="text-xs text-slate-600 ml-1">
                  {customRules.length} 条
                </span>
              </h3>
              <div className="space-y-3">
                {customRules.map(renderRuleCard)}
              </div>
            </div>
          </>
        )}

        {!rulesLoading && !rulesError && customRules.length === 0 && (
          <button
            onClick={handleCreateClick}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg py-4 border border-dashed border-slate-600/50 text-slate-500 text-sm hover:border-sky-500/40 hover:text-sky-400 transition-all duration-200 mt-3"
          >
            <Plus className="w-4 h-4" />
            新建规则
          </button>
        )}

        {showCreateForm && (
          <div className="mt-6 border-t border-slate-700/50 pt-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">
              {editingRule ? '编辑规则' : '创建规则'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {formError && (
                <div className="rounded-lg border border-red-500/20 bg-red-950/20 px-3 py-2 text-xs text-red-400">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="规则名称"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    描述
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="可选描述"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    匹配类型
                  </label>
                  <select
                    value={form.match_type}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        match_type: e.target.value as 'text' | 'regex' | 'glob',
                      }))
                    }
                    className={selectClass + ' w-full'}
                  >
                    <option value="text">纯文本</option>
                    <option value="regex">正则表达式</option>
                    <option value="glob">Glob</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    匹配范围
                  </label>
                  <select
                    value={form.match_scope}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        match_scope: e.target.value as 'added_lines' | 'context_lines' | 'full_file',
                      }))
                    }
                    className={selectClass + ' w-full'}
                  >
                    <option value="added_lines">仅新增行</option>
                    <option value="context_lines">上下文行</option>
                    <option value="full_file">全文件</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    匹配模式 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.match_pattern}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, match_pattern: e.target.value }))
                    }
                    placeholder="例如: console\.log\( 或 *.log"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    严重度
                  </label>
                  <select
                    value={form.severity}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        severity: e.target.value as 'critical' | 'high' | 'medium' | 'low',
                      }))
                    }
                    className={selectClass + ' w-full'}
                  >
                    {severityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    文件过滤（可选）
                  </label>
                  <input
                    type="text"
                    value={form.file_filter}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, file_filter: e.target.value }))
                    }
                    placeholder="例如: src/**/*.ts"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    修复建议（可选）
                  </label>
                  <input
                    type="text"
                    value={form.suggestion}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, suggestion: e.target.value }))
                    }
                    placeholder="命中时给出的建议"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_enabled}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, is_enabled: e.target.checked }))
                      }
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500/30"
                    />
                    <span className="text-sm text-slate-300">启用规则</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-violet-500 text-white text-sm font-semibold hover:from-sky-400 hover:to-violet-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {editingRule ? '保存修改' : '创建规则'}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function RuleMatchesView({ ruleMatches }: { ruleMatches: RuleMatch[] }) {
  if (ruleMatches.length === 0) return null;

  const grouped = useMemo(() => {
    const map = new Map<string, RuleMatch[]>();
    for (const m of ruleMatches) {
      const list = map.get(m.severity);
      if (list) {
        list.push(m);
      } else {
        map.set(m.severity, [m]);
      }
    }
    const order = ['critical', 'high', 'medium', 'low'];
    return order.filter((k) => map.has(k)).map((k) => ({ severity: k, matches: map.get(k)! }));
  }, [ruleMatches]);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-violet-400" />
        自定义规则命中
        <span className="text-xs text-slate-500 ml-auto">
          共 {ruleMatches.length} 项
        </span>
      </h2>

      <div className="space-y-4">
        {grouped.map(({ severity, matches }) => {
          const sevConfig =
            RISK_SEVERITY_CONFIG[severity as RiskSeverity] ?? RISK_SEVERITY_CONFIG.medium;
          return (
            <div key={severity}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${sevConfig.textClass} ${sevConfig.bgClass}`}
                >
                  {sevConfig.label}
                </span>
                <span className="text-[11px] text-slate-500">{matches.length} 项</span>
              </div>

              <div className="space-y-2">
                 {matches.map((m, idx) => (
                   <div
                     key={`${m.rule_id}-${idx}`}
                     className={`rounded-lg border-l-2 ${sevConfig.borderClass} ${sevConfig.bgClass} p-3.5`}
                   >
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-1.5">
                         <span className="text-sm font-semibold text-slate-200">
                           {m.rule_name}
                         </span>
                         <span className="text-xs text-slate-500 flex items-center gap-1">
                           <FileCode2 className="w-3 h-3" />
                           {m.file}
                           {m.line > 0 && (
                             <>
                               <MapPin className="w-3 h-3 ml-0.5" />
                               <span className="text-slate-600">L{m.line}</span>
                             </>
                           )}
                         </span>
                       </div>

                       <div className="rounded-md bg-slate-900/60 border border-slate-700/40 p-2.5 mb-2">
                         <code className="text-xs text-amber-300/90 break-all">
                           {m.matched_text}
                         </code>
                       </div>

                       {m.suggestion && (
                         <p className="text-xs text-sky-400/80 leading-relaxed">
                           <Lightbulb className="w-3 h-3 inline mr-1" />
                           {m.suggestion}
                         </p>
                       )}
                     </div>
                   </div>
                 ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== 历史记录辅助函数 =====

/** 格式化 ISO 日期为中文显示 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 将 HistoryDetail 转换为 AnalyzeResponse 兼容格式，复用现有展示组件 */
function buildAnalyzeResponseFromHistory(detail: HistoryDetail): AnalyzeResponse {
  return {
    pr_info: {
      owner: detail.repo_owner,
      repo: detail.repo_name,
      number: detail.pr_number,
      title: detail.pr_title,
      description: detail.pr_description,
      author: detail.author,
      base_branch: detail.base_branch,
      head_branch: detail.head_branch,
      files_changed: detail.files_changed,
      additions: detail.additions,
      deletions: detail.deletions,
      files: [],
      diff_content: '',
    },
    summary: detail.summary,
    risk_items: detail.risk_items,
    suggestions: detail.suggestions,
    risk_score: detail.risk_score,
    risk_level: detail.risk_level,
    estimated_review_minutes: detail.estimated_review_minutes,
    rule_matches: [],
  };
}

// ===== 历史记录面板 =====

interface HistoryPanelProps {
  refreshTrigger: number;
}

function HistoryPanel({ refreshTrigger }: HistoryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [historyMode, setHistoryMode] = useState<'list' | 'detail'>('list');
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [detailData, setDetailData] = useState<HistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const items = await fetchHistory(20);
      setHistoryItems(items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载历史记录失败';
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, refreshTrigger]);

  const handleToggleExpand = () => {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);
    if (nextExpanded && historyItems.length === 0 && !historyLoading) {
      loadHistory();
    }
  };

  const handleItemClick = async (item: HistoryItem) => {
    setHistoryMode('detail');
    setDetailLoading(true);
    setDetailError('');
    try {
      const detail = await fetchHistoryDetail(item.id);
      setDetailData(detail);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载详情失败';
      setDetailError(message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBackToList = () => {
    setHistoryMode('list');
    setDetailData(null);
    setDetailError('');
  };

  if (historyMode === 'detail') {
    return (
      <div className="max-w-3xl mx-auto mb-10">
        <button
          onClick={handleBackToList}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-sm hover:bg-slate-700 transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回历史记录
        </button>

        {detailLoading && <LoadingState />}

        {detailError && (
          <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-red-400 font-semibold mb-2">加载失败</h3>
            <p className="text-slate-400 text-sm">{detailError}</p>
          </div>
        )}

        {detailData && (
          <>
            <SummaryCard data={buildAnalyzeResponseFromHistory(detailData)} />
            <RiskList riskItems={detailData.risk_items} />
            <SuggestionList suggestions={detailData.suggestions} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mb-10">
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm">
        <button
          onClick={handleToggleExpand}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/20 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-semibold text-slate-200">历史记录</h2>
            {historyItems.length > 0 && (
              <span className="text-xs text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full">
                {historyItems.length}
              </span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {isExpanded && (
          <div className="px-5 pb-5 border-t border-slate-700/50">
            {historyLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
                <span className="ml-2 text-sm text-slate-400">加载中...</span>
              </div>
            )}

            {historyError && (
              <div className="py-6 text-center">
                <p className="text-sm text-red-400">{historyError}</p>
                <button
                  onClick={loadHistory}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
                >
                  <Search className="w-3 h-3" />
                  重试
                </button>
              </div>
            )}

            {!historyLoading && !historyError && historyItems.length === 0 && (
              <div className="py-8 text-center">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">暂无历史记录</p>
              </div>
            )}

            {!historyLoading && historyItems.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 pt-3">
                {historyItems.map((item) => {
                  const scoreConfig = RISK_LEVEL_SCORE_CONFIG[item.risk_level];
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className="w-full text-left rounded-lg bg-slate-800/50 border border-slate-700/40 p-4 hover:border-sky-500/40 hover:bg-slate-800/70 transition-all duration-200 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-slate-200 truncate group-hover:text-sky-300 transition-colors">
                            {item.pr_title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                            <span>
                              {item.repo_owner}/{item.repo_name}#{item.pr_number}
                            </span>
                            <span className="text-slate-600">|</span>
                            <span>{item.author}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <FileCode2 className="w-3 h-3" />
                            {item.files_changed}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${scoreConfig.textClass} ${scoreConfig.bgClass}`}
                          >
                            {item.risk_score}
                          </span>
                          <span className="text-[11px] text-slate-500 whitespace-nowrap">
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 主 Dashboard 组件 =====

export default function Dashboard() {
  const [mode, setMode] = useState<DashboardMode>('single');
  const [pageStatus, setPageStatus] = useState<PageStatus>('idle');
  const [resultData, setResultData] = useState<AnalyzeResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastParams, setLastParams] = useState<{
    owner: string;
    repo: string;
    prNumber: number;
  } | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [batchStatus, setBatchStatus] = useState<PageStatus>('idle');
  const [batchResult, setBatchResult] = useState<BatchAnalyzeResponse | null>(null);
  const [batchError, setBatchError] = useState('');

  useEffect(() => {
    if (pageStatus === 'success') {
      setHistoryRefreshKey((prev) => prev + 1);
    }
  }, [pageStatus]);

  const handleAnalyze = async (owner: string, repo: string, prNumber: number) => {
    setPageStatus('loading');
    setErrorMessage('');
    setResultData(null);
    setLastParams({ owner, repo, prNumber });

    try {
      const response = await analyzePR({ owner, repo, prNumber });

      if (response.success) {
        setResultData(response.data);
        setPageStatus('success');
      } else {
        setErrorMessage(response.error || '未知错误，请稍后重试');
        setPageStatus('error');
      }
    } catch (err: unknown) {
      const message =
        err instanceof TypeError
          ? '网络连接失败，请确认后端服务是否已启动'
          : err instanceof Error
            ? err.message
            : '请求发生未知异常';
      setErrorMessage(message);
      setPageStatus('error');
    }
  };

  const handleRetry = () => {
    if (lastParams) {
      handleAnalyze(lastParams.owner, lastParams.repo, lastParams.prNumber);
    }
  };

  const handleReset = () => {
    setPageStatus('idle');
    setResultData(null);
    setErrorMessage('');
    setLastParams(null);
  };

  const handleBatchAnalyze = async (prs: BatchAnalyzeItem[]) => {
    setBatchStatus('loading');
    setBatchError('');
    setBatchResult(null);

    try {
      const response = await analyzeBatch(prs);
      setBatchResult(response);
      setBatchStatus('success');
    } catch (err: unknown) {
      const message =
        err instanceof TypeError
          ? '网络连接失败，请确认后端服务是否已启动'
          : err instanceof Error
            ? err.message
            : '批量分析请求发生未知异常';
      setBatchError(message);
      setBatchStatus('error');
    }
  };

  const handleBatchReset = () => {
    setBatchStatus('idle');
    setBatchResult(null);
    setBatchError('');
  };

  const handleModeChange = (newMode: DashboardMode) => {
    setMode(newMode);
    if (newMode === 'single') {
      handleBatchReset();
    } else if (newMode === 'batch') {
      handleReset();
    }
  };

  return (
    <div className="min-h-screen px-4 pb-16">
      <BrandHeader />

      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-lg bg-slate-800/60 border border-slate-700/50 p-1">
          <button
            onClick={() => handleModeChange('single')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === 'single'
                ? 'bg-slate-700 text-slate-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <GitPullRequest className="w-4 h-4" />
            单个 PR
          </button>
          <button
            onClick={() => handleModeChange('batch')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === 'batch'
                ? 'bg-slate-700 text-slate-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            批量对比
          </button>
          <button
            onClick={() => handleModeChange('rules')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              mode === 'rules'
                ? 'bg-slate-700 text-slate-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            自定义规则
          </button>
        </div>
      </div>

      {mode === 'single' && (
        <>
          <InputForm onSubmit={handleAnalyze} isLoading={pageStatus === 'loading'} />
          <HistoryPanel refreshTrigger={historyRefreshKey} />

          {pageStatus === 'loading' && <LoadingState />}
          {pageStatus === 'error' && (
            <ErrorState error={errorMessage} onRetry={handleRetry} />
          )}
          {pageStatus === 'success' && resultData && (
            <ResultSection data={resultData} onReset={handleReset} />
          )}
        </>
      )}

      {mode === 'batch' && (
        <>
          <BatchInputForm onSubmit={handleBatchAnalyze} isLoading={batchStatus === 'loading'} />

          {batchStatus === 'loading' && <LoadingState />}
          {batchStatus === 'error' && (
            <ErrorState
              error={batchError}
              onRetry={() => {}}
            />
          )}
          {batchStatus === 'success' && batchResult && (
            <BatchResultView data={batchResult} onReset={handleBatchReset} />
          )}
        </>
      )}

      {mode === 'rules' && <CustomRulesPanel />}
    </div>
  );
}
