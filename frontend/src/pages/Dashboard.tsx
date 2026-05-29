/**
 * @file src/pages/Dashboard.tsx
 * @description AI PR Review 仪表盘主页面
 * 提供 PR 输入、分析触发、结果展示（摘要/风险/建议）完整交互流程
 */

import { useState, type FormEvent } from 'react';
import {
  GitPullRequest,
  Loader2,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  FileCode2,
  Clock,
  Search,
  GitBranch,
} from 'lucide-react';
import { analyzePR } from '../api/review';
import type {
  AnalyzeSuccessResponse,
  RiskItem,
  SuggestionItem,
} from '../types/review';
import {
  RiskSeverity,
  RISK_SEVERITY_CONFIG,
  SUGGESTION_CATEGORY_CONFIG,
} from '../types/review';

// ===== 页面状态类型 =====

type PageStatus = 'idle' | 'loading' | 'success' | 'error';

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
  data: AnalyzeSuccessResponse;
  onReset: () => void;
}

/** 评分环颜色映射 */
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

/** PR 摘要卡片 */
function SummaryCard({ data }: { data: AnalyzeSuccessResponse }) {
  const { summary, analysisTime } = data;
  const scoreColor = getScoreColor(summary.score);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <FileCode2 className="w-5 h-5 text-sky-400" />
        PR 摘要
      </h2>

      {/* PR 标题 + 评分 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white leading-snug truncate">
            {summary.title}
          </h3>
          <p className="text-slate-400 text-sm mt-1 line-clamp-2">
            {summary.description}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-3 bg-slate-800/70 rounded-xl px-4 py-3">
          <div className="text-center">
            <span className={`text-3xl font-bold ${scoreColor}`}>{summary.score}</span>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
              综合评分
            </p>
          </div>
        </div>
      </div>

      {/* 统计指标 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatItem label="变更文件" value={summary.filesChanged} />
        <StatItem label="新增行" value={summary.additions} color="text-emerald-400" />
        <StatItem label="删除行" value={summary.deletions} color="text-red-400" />
        <StatItem label="风险项" value={summary.totalRisks} color="text-orange-400" />
        <StatItem label="建议" value={summary.totalSuggestions} color="text-sky-400" />
      </div>

      {/* 耗时 */}
      {analysisTime !== undefined && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          分析耗时 {analysisTime.toFixed(1)} 秒
        </div>
      )}
    </div>
  );
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

/** 风险列表 */
function RiskList({ risks }: { risks: RiskItem[] }) {
  if (risks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-emerald-400" />
          风险项
        </h2>
        <p className="text-sm text-emerald-400/80">
          未发现风险项，代码质量良好
        </p>
      </div>
    );
  }

  // 按严重程度排序
  const severityOrder: Record<string, number> = {
    [RiskSeverity.Critical]: 0,
    [RiskSeverity.High]: 1,
    [RiskSeverity.Medium]: 2,
    [RiskSeverity.Low]: 3,
  };
  const sorted = [...risks].sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
  );

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-orange-400" />
        风险项
        <span className="text-xs text-slate-500 ml-auto">
          共 {risks.length} 项
        </span>
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
                  <h4 className="text-sm font-semibold text-slate-200">
                    {risk.title}
                  </h4>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                    {risk.description}
                  </p>
                  {risk.filePath && (
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      <FileCode2 className="w-3 h-3" />
                      {risk.filePath}
                      {risk.lineRange && (
                        <span className="text-slate-600">{risk.lineRange}</span>
                      )}
                    </p>
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

/** 建议列表 */
function SuggestionList({ suggestions }: { suggestions: SuggestionItem[] }) {
  if (suggestions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-emerald-400" />
          改进建议
        </h2>
        <p className="text-sm text-emerald-400/80">
          暂无改进建议
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-yellow-400" />
        改进建议
        <span className="text-xs text-slate-500 ml-auto">
          共 {suggestions.length} 条
        </span>
      </h2>

      <div className="space-y-3">
        {suggestions.map((suggestion, idx) => {
          const catConfig = SUGGESTION_CATEGORY_CONFIG[suggestion.category];
          return (
            <div
              key={idx}
              className="rounded-lg bg-slate-800/50 border border-slate-700/40 p-4 transition-colors hover:border-slate-600/50"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${catConfig.textClass} ${catConfig.bgClass} whitespace-nowrap mt-0.5`}
                >
                  {catConfig.label}
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-200">
                    {suggestion.title}
                  </h4>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                    {suggestion.description}
                  </p>
                  {suggestion.codeExample && (
                    <pre className="mt-3 rounded-md bg-slate-900/80 border border-slate-700/50 p-3 text-xs text-slate-300 overflow-x-auto">
                      <code>{suggestion.codeExample}</code>
                    </pre>
                  )}
                  {suggestion.filePath && (
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      <FileCode2 className="w-3 h-3" />
                      {suggestion.filePath}
                    </p>
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
      <RiskList risks={data.risks} />
      <SuggestionList suggestions={data.suggestions} />
      <ResetBar onReset={onReset} />
    </div>
  );
}

// ===== 主 Dashboard 组件 =====

export default function Dashboard() {
  const [pageStatus, setPageStatus] = useState<PageStatus>('idle');
  const [resultData, setResultData] = useState<AnalyzeSuccessResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  // 缓存最近一次请求参数用于重试
  const [lastParams, setLastParams] = useState<{
    owner: string;
    repo: string;
    prNumber: number;
  } | null>(null);

  /** 发起分析 */
  const handleAnalyze = async (owner: string, repo: string, prNumber: number) => {
    setPageStatus('loading');
    setErrorMessage('');
    setResultData(null);
    setLastParams({ owner, repo, prNumber });

    try {
      const response = await analyzePR({ owner, repo, prNumber });

      if (response.success) {
        setResultData(response);
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

  /** 重试 */
  const handleRetry = () => {
    if (lastParams) {
      handleAnalyze(lastParams.owner, lastParams.repo, lastParams.prNumber);
    }
  };

  /** 重置到初始状态 */
  const handleReset = () => {
    setPageStatus('idle');
    setResultData(null);
    setErrorMessage('');
    setLastParams(null);
  };

  return (
    <div className="min-h-screen px-4 pb-16">
      <BrandHeader />
      <InputForm onSubmit={handleAnalyze} isLoading={pageStatus === 'loading'} />

      {pageStatus === 'loading' && <LoadingState />}
      {pageStatus === 'error' && (
        <ErrorState error={errorMessage} onRetry={handleRetry} />
      )}
      {pageStatus === 'success' && resultData && (
        <ResultSection data={resultData} onReset={handleReset} />
      )}
    </div>
  );
}
