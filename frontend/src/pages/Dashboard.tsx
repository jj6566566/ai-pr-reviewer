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
  Settings,
  Pencil,
  Trash2,
} from 'lucide-react';
import { analyzePR, fetchHistory, fetchHistoryDetail, analyzeBatch, fetchModes, createMode, updateMode, deleteMode } from '../api/review';
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
  ReviewMode,
} from '../types/review';
import {
  RISK_SEVERITY_CONFIG,
  SUGGESTION_CATEGORY_CONFIG,
  SEVERITY_ORDER,
  RISK_LEVEL_SCORE_CONFIG,
} from '../types/review';

// ===== 页面状态类型 =====

type PageStatus = 'idle' | 'loading' | 'success' | 'error';

type DashboardMode = 'single' | 'batch';

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
  onSubmit: (owner: string, repo: string, prNumber: number, modeId?: number) => void;
  isLoading: boolean;
}

/** 输入表单区域 */
function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [prNumber, setPrNumber] = useState('');
  const [modes, setModes] = useState<ReviewMode[]>([]);
  const [selectedModeId, setSelectedModeId] = useState<number | undefined>(undefined);
  const [modesLoading, setModesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadModes = async () => {
      try {
        setModesLoading(true);
        const data = await fetchModes();
        if (!cancelled) {
          setModes(data);
          const defaultMode = data.length > 0 ? data[0] : null;
          if (defaultMode) {
            setSelectedModeId(defaultMode.id);
          }
        }
      } catch {
        if (!cancelled) {
          setModes([]);
        }
      } finally {
        if (!cancelled) {
          setModesLoading(false);
        }
      }
    };
    loadModes();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedOwner = owner.trim();
    const trimmedRepo = repo.trim();
    const num = parseInt(prNumber, 10);

    if (!trimmedOwner || !trimmedRepo || !prNumber || isNaN(num) || num <= 0) {
      return;
    }

    onSubmit(trimmedOwner, trimmedRepo, num, selectedModeId);
  };

  const isFormValid =
    owner.trim() !== '' &&
    repo.trim() !== '' &&
    prNumber.trim() !== '' &&
    parseInt(prNumber, 10) > 0;

  const inputBaseClass =
    'w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 focus:bg-slate-800/80';

  const selectClass =
    'w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-sky-500/60';

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

      {/* 评审模式选择器 */}
      <div className="mb-3">
        {modesLoading ? (
          <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            加载模式...
          </div>
        ) : modes.length > 0 ? (
          <select
            value={selectedModeId ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedModeId(val ? Number(val) : undefined);
            }}
            disabled={isLoading}
            className={selectClass}
          >
            {modes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-sm text-slate-500 px-4 py-2.5">无可用模式</div>
        )}
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

// ===== 评审模式管理面板 =====

interface ReviewModePanelProps {
  modes: ReviewMode[];
  onModesChanged: () => void;
}

function ReviewModePanel({ modes, onModesChanged }: ReviewModePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingMode, setEditingMode] = useState<ReviewMode | null>(null);

  const presetModes = modes.filter((m) => m.is_preset);
  const customModes = modes.filter((m) => !m.is_preset);

  return (
    <div className="max-w-3xl mx-auto mb-10">
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm">
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/20 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-semibold text-slate-200">评审模式</h2>
            <span className="text-xs text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full">
              {modes.length}
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {isExpanded && (
          <div className="px-5 pb-5 border-t border-slate-700/50 pt-3">
            {modes.length === 0 && (
              <div className="py-8 text-center">
                <Settings className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">暂无评审模式</p>
              </div>
            )}

            {presetModes.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  预设模式
                </p>
                <div className="space-y-2">
                  {presetModes.map((mode) => (
                    <div
                      key={mode.id}
                      className="rounded-lg bg-slate-800/60 border border-slate-700/50 p-3"
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-200">{mode.name}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-sky-950/50 text-sky-400">
                          预设
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-1.5">
                        {mode.description}
                      </p>
                      <span className="text-[11px] text-slate-500">
                        温度: {mode.temperature.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customModes.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  自定义模式
                </p>
                <div className="space-y-2">
                  {customModes.map((mode) => (
                    <div
                      key={mode.id}
                      className="rounded-lg bg-slate-800/60 border border-slate-700/50 p-3"
                    >
                      {editingMode?.id === mode.id ? (
                        <ModeEditForm
                          mode={mode}
                          onCancel={() => setEditingMode(null)}
                          onSaved={() => {
                            setEditingMode(null);
                            onModesChanged();
                          }}
                        />
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-sm font-semibold text-slate-200">{mode.name}</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => setEditingMode(mode)}
                                className="p-1 rounded text-slate-500 hover:text-sky-400 hover:bg-sky-950/30 transition-colors"
                                title="编辑"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await deleteMode(mode.id);
                                    onModesChanged();
                                  } catch {
                                    /* ignore */
                                  }
                                }}
                                className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                                title="删除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed mb-1.5">
                            {mode.description}
                          </p>
                          <span className="text-[11px] text-slate-500">
                            温度: {mode.temperature.toFixed(1)}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showCreateForm ? (
              <ModeCreateForm
                onCancel={() => setShowCreateForm(false)}
                onCreated={() => {
                  setShowCreateForm(false);
                  onModesChanged();
                }}
              />
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 border border-dashed border-slate-600/50 text-slate-400 text-sm hover:border-sky-500/40 hover:text-sky-400 transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                新建模式
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ModeCreateFormProps {
  onCancel: () => void;
  onCreated: () => void;
}

function ModeCreateForm({ onCancel, onCreated }: ModeCreateFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState('0.7');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !systemPrompt.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await createMode({
        name: name.trim(),
        description: description.trim(),
        system_prompt: systemPrompt.trim(),
        temperature: parseFloat(temperature) || 0.7,
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-sky-500/60';

  return (
    <form onSubmit={handleSubmit} className="rounded-lg bg-slate-800/60 border border-slate-700/50 p-4 mb-3">
      <p className="text-sm font-semibold text-slate-200 mb-3">新建评审模式</p>

      {error && (
        <div className="mb-3 rounded-lg bg-red-950/30 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-2.5">
        <div>
          <input
            type="text"
            placeholder="模式名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            className={inputClass}
          />
        </div>
        <div>
          <input
            type="text"
            placeholder="模式描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            className={inputClass}
          />
        </div>
        <div>
          <textarea
            placeholder="System Prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            disabled={submitting}
            rows={4}
            className={`${inputClass} resize-y`}
          />
        </div>
        <div>
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            placeholder="温度 (0.0-2.0)"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            disabled={submitting}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          type="submit"
          disabled={submitting || !name.trim() || !description.trim() || !systemPrompt.trim()}
          className="flex-1 rounded-lg py-2 text-sm font-semibold bg-gradient-to-r from-sky-500 to-violet-500 text-white hover:from-sky-400 hover:to-violet-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              创建中...
            </span>
          ) : (
            '创建'
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 rounded-lg text-sm text-slate-400 border border-slate-700/60 hover:text-slate-300 hover:border-slate-600/60 transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  );
}

interface ModeEditFormProps {
  mode: ReviewMode;
  onCancel: () => void;
  onSaved: () => void;
}

function ModeEditForm({ mode, onCancel, onSaved }: ModeEditFormProps) {
  const [name, setName] = useState(mode.name);
  const [description, setDescription] = useState(mode.description);
  const [systemPrompt, setSystemPrompt] = useState(mode.system_prompt);
  const [temperature, setTemperature] = useState(String(mode.temperature));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !systemPrompt.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await updateMode(mode.id, {
        name: name.trim(),
        description: description.trim(),
        system_prompt: systemPrompt.trim(),
        temperature: parseFloat(temperature) || 0.7,
      });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-sky-500/60';

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-2 rounded-lg bg-red-950/30 border border-red-500/20 px-3 py-1.5 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <input
          type="text"
          placeholder="模式名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="模式描述"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={submitting}
          className={inputClass}
        />
        <textarea
          placeholder="System Prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          disabled={submitting}
          rows={3}
          className={`${inputClass} resize-y`}
        />
        <input
          type="number"
          step="0.1"
          min="0"
          max="2"
          placeholder="温度"
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
          disabled={submitting}
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-2 mt-2">
        <button
          type="submit"
          disabled={submitting || !name.trim() || !description.trim() || !systemPrompt.trim()}
          className="flex-1 rounded-lg py-1.5 text-xs font-semibold bg-gradient-to-r from-sky-500 to-violet-500 text-white hover:from-sky-400 hover:to-violet-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              保存中...
            </span>
          ) : (
            '保存'
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700/60 hover:text-slate-300 hover:border-slate-600/60 transition-colors"
        >
          取消
        </button>
      </div>
    </form>
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
    modeId?: number;
  } | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [reviewModes, setReviewModes] = useState<ReviewMode[]>([]);
  const [modesRefreshKey, setModesRefreshKey] = useState(0);

  const [batchStatus, setBatchStatus] = useState<PageStatus>('idle');
  const [batchResult, setBatchResult] = useState<BatchAnalyzeResponse | null>(null);
  const [batchError, setBatchError] = useState('');

  useEffect(() => {
    if (pageStatus === 'success') {
      setHistoryRefreshKey((prev) => prev + 1);
    }
  }, [pageStatus]);

  useEffect(() => {
    let cancelled = false;
    const loadModes = async () => {
      try {
        const data = await fetchModes();
        if (!cancelled) {
          setReviewModes(data);
        }
      } catch {
        /* ignore */
      }
    };
    loadModes();
    return () => {
      cancelled = true;
    };
  }, [modesRefreshKey]);

  const handleModesChanged = () => {
    setModesRefreshKey((prev) => prev + 1);
  };

  const handleAnalyze = async (owner: string, repo: string, prNumber: number, modeId?: number) => {
    setPageStatus('loading');
    setErrorMessage('');
    setResultData(null);
    setLastParams({ owner, repo, prNumber, modeId });

    try {
      const response = await analyzePR({ owner, repo, prNumber, modeId });

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
      handleAnalyze(lastParams.owner, lastParams.repo, lastParams.prNumber, lastParams.modeId);
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
    } else {
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
        </div>
      </div>

      {mode === 'single' && (
        <>
          <InputForm onSubmit={handleAnalyze} isLoading={pageStatus === 'loading'} />
          <HistoryPanel refreshTrigger={historyRefreshKey} />
          <ReviewModePanel modes={reviewModes} onModesChanged={handleModesChanged} />

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
    </div>
  );
}
