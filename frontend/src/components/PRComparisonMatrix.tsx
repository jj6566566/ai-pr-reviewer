import { useMemo } from 'react';
import type { AnalyzeResponse, RiskSeverity } from '../types/review';
import { RISK_LEVEL_SCORE_CONFIG } from '../types/review';
import {
  GitPullRequest,
  AlertTriangle,
  FileCode2,
  PlusCircle,
  MinusCircle,
  Lightbulb,
  ScrollText,
} from 'lucide-react';

interface PRComparisonMatrixProps {
  results: AnalyzeResponse[];
}

function truncateTitle(title: string, maxLen: number = 15): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen) + '...';
}

const RISK_LEVEL_COLOR_MAP: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low: 'text-green-400 bg-green-500/10 border-green-500/30',
};

type SeverityCounts = Record<RiskSeverity, number>;

function countSeverities(items: { severity: RiskSeverity }[]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const item of items) {
    counts[item.severity]++;
  }
  return counts;
}

const SEVERITY_LABELS: Record<RiskSeverity, string> = {
  critical: '严重',
  high: '高危',
  medium: '中',
  low: '低',
};

export default function PRComparisonMatrix({ results }: PRComparisonMatrixProps) {
  const sorted = useMemo(
    () => [...results].sort((a, b) => b.risk_score - a.risk_score),
    [results],
  );

  if (results.length === 0) return null;

  return (
    <div className="max-w-4xl mx-auto mb-6">
      <div className="rounded-xl border border-slate-700/50 bg-slate-950/80 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700/50">
          <ScrollText className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-semibold text-slate-200">PR 对比矩阵</h2>
          <span className="text-xs text-slate-500 ml-auto">
            {results.length} 个 PR
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <GitPullRequest className="w-3.5 h-3.5" />
                    PR
                  </div>
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    风险评分
                  </div>
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  风险等级
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5" />
                    变更文件
                  </div>
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                    新增行
                  </div>
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5">
                    <MinusCircle className="w-3.5 h-3.5 text-red-400" />
                    删除行
                  </div>
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  风险项总数
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  风险分布
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" />
                    建议
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((result, idx) => {
                const scoreConfig = RISK_LEVEL_SCORE_CONFIG[result.risk_level];
                const sevCounts = countSeverities(result.risk_items);
                const isEven = idx % 2 === 0;
                const severityOrder: RiskSeverity[] = ['critical', 'high', 'medium', 'low'];

                return (
                  <tr
                    key={result.pr_info.number}
                    className={`border-b border-slate-700/30 transition-colors hover:bg-slate-800/40 ${
                      isEven ? 'bg-slate-900/30' : 'bg-transparent'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
                        <span className="text-xs font-mono font-semibold text-slate-500 whitespace-nowrap">
                          #{result.pr_info.number}
                        </span>
                        <span
                          className="text-sm text-slate-200 truncate"
                          title={result.pr_info.title}
                        >
                          {truncateTitle(result.pr_info.title)}
                        </span>
                      </div>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className={`text-sm font-bold ${scoreConfig.textClass}`}>
                        {result.risk_score}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          RISK_LEVEL_COLOR_MAP[result.risk_level] ?? RISK_LEVEL_COLOR_MAP.low
                        }`}
                      >
                        {scoreConfig.label}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-slate-300">
                        {result.pr_info.files_changed}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-emerald-400 font-medium tabular-nums">
                        +{result.pr_info.additions.toLocaleString()}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-sm text-red-400 font-medium tabular-nums">
                        -{result.pr_info.deletions.toLocaleString()}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span
                        className={`text-sm font-bold ${
                          result.risk_items.length > 0 ? 'text-orange-400' : 'text-slate-500'
                        }`}
                      >
                        {result.risk_items.length}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {severityOrder.map((sev) => {
                          const count = sevCounts[sev];
                          if (count === 0) return null;
                          const sevColorMap: Record<RiskSeverity, string> = {
                            critical: 'text-red-400 bg-red-500/10',
                            high: 'text-orange-400 bg-orange-500/10',
                            medium: 'text-yellow-400 bg-yellow-500/10',
                            low: 'text-green-400 bg-green-500/10',
                          };
                          return (
                            <span
                              key={sev}
                              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${sevColorMap[sev]}`}
                              title={`${SEVERITY_LABELS[sev]}: ${count}`}
                            >
                              {count}
                            </span>
                          );
                        })}
                        {result.risk_items.length === 0 && (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span
                        className={`text-sm font-bold ${
                          result.suggestions.length > 0 ? 'text-sky-400' : 'text-slate-500'
                        }`}
                      >
                        {result.suggestions.length}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sorted.length > 1 && (
          <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-700/50">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-xs text-slate-500">
                风险最高:{' '}
                <span className="text-slate-300 font-medium">
                  #{sorted[0].pr_info.number}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">
                平均风险分:{' '}
                <span className="text-slate-300 font-medium">
                  {Math.round(
                    sorted.reduce((sum, r) => sum + r.risk_score, 0) / sorted.length,
                  )}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
