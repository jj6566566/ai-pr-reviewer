import { useEffect, useState, useMemo } from "react"
import { Activity, GitPullRequest, AlertTriangle, Shield, Clock, TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RepoHealthItem {
  full_name: string
  total_prs: number
  avg_risk_score: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  last_analysis_at: string
}

interface RepoHealthCardsProps {
  loading: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 从 localStorage 读取 token，构建认证请求头 */
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("pr_review_token")
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

/** 根据风险分值返回对应语义颜色 */
function getScoreColor(score: number): string {
  if (score <= 30) return "#06d6a0" // teal — 健康
  if (score <= 60) return "#f59e0b" // amber — 警告
  return "#ef4444" // red — 危险
}

/** 计算距离上次分析的天数，返回可读文本 */
function daysAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days < 1) return "今天"
  if (days === 1) return "1天前"
  return `${days}天前`
}

/** 风险严重度配置（顺序：高 → 低，与视觉权重一致） */
const severityConfig = [
  { key: "critical_count" as const, label: "致命", color: "#ef4444" },
  { key: "high_count" as const, label: "高危", color: "#f59e0b" },
  { key: "medium_count" as const, label: "中等", color: "#3b82f6" },
  { key: "low_count" as const, label: "建议", color: "#06d6a0" },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** SVG 圆弧评分仪表 */
function ScoreGauge({ score }: { score: number }) {
  const color = getScoreColor(score)
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const clampedScore = Math.min(Math.max(score, 0), 100)
  const offset = circumference * (1 - clampedScore / 100)

  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        {/* 底环 */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#1e2440"
          strokeWidth="6"
        />
        {/* 分值弧 */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      {/* 居中分值文本 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold" style={{ color }}>
          {Math.round(score)}
        </span>
      </div>
    </div>
  )
}

/** 风险严重度分布条形图 */
function SeverityBars({ item }: { item: RepoHealthItem }) {
  const counts = [
    item.critical_count,
    item.high_count,
    item.medium_count,
    item.low_count,
  ]
  const maxCount = Math.max(...counts, 1)

  return (
    <div className="space-y-1 mt-1.5">
      {severityConfig.map((sev) => {
        const count = item[sev.key]
        const pct = (count / maxCount) * 100
        return (
          <div key={sev.key} className="flex items-center gap-2 text-[10px]">
            {/* 数量 */}
            <span className="w-5 text-[#7b829c] tabular-nums text-right">
              {count}
            </span>
            {/* 占比条 */}
            <div className="flex-1 h-1 bg-[#1e2440] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: sev.color,
                  minWidth: count > 0 ? "4px" : "0px",
                }}
              />
            </div>
            {/* 标签 */}
            <span className="w-5 text-[#7b829c]">{sev.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/** 加载骨架卡片 */
function SkeletonCard() {
  return (
    <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-5 animate-pulse">
      {/* 行：圆环 + 右侧占位 */}
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-full bg-[#1e2440]" />
        <div className="flex-1 space-y-3 pt-1">
          <div className="h-4 bg-[#1e2440] rounded w-3/4" />
          <div className="h-3 bg-[#1e2440] rounded w-1/4" />
          <div className="space-y-1.5">
            <div className="h-1 bg-[#1e2440] rounded w-full" />
            <div className="h-1 bg-[#1e2440] rounded w-4/5" />
            <div className="h-1 bg-[#1e2440] rounded w-3/5" />
            <div className="h-1 bg-[#1e2440] rounded w-2/5" />
          </div>
        </div>
      </div>
      {/* 底部分隔 */}
      <div className="mt-4 pt-3 border-t border-[#1e2440]/50">
        <div className="h-3 bg-[#1e2440] rounded w-1/3" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function RepoHealthCards({
  loading: externalLoading,
}: RepoHealthCardsProps) {
  const [repos, setRepos] = useState<RepoHealthItem[]>([])
  const [internalLoading, setInternalLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"risk" | "prs" | "recent">("risk")

  const isLoading = externalLoading || internalLoading

  const sortedRepos = useMemo(() => {
    const copy = [...repos]
    switch (sortBy) {
      case "risk":
        return copy.sort((a, b) => b.avg_risk_score - a.avg_risk_score)
      case "prs":
        return copy.sort((a, b) => b.total_prs - a.total_prs)
      case "recent":
        return copy.sort(
          (a, b) =>
            new Date(b.last_analysis_at).getTime() -
            new Date(a.last_analysis_at).getTime()
        )
      default:
        return copy
    }
  }, [repos, sortBy])

  const summary = useMemo(() => {
    if (repos.length === 0) return null
    const avgScore =
      repos.reduce((sum, r) => sum + r.avg_risk_score, 0) / repos.length
    const totalCritical = repos.reduce((sum, r) => sum + r.critical_count, 0)
    const mostAtRisk = repos.reduce((worst, r) =>
      r.avg_risk_score > worst.avg_risk_score ? r : worst
    )
    const healthiest = repos.reduce((best, r) =>
      r.avg_risk_score < best.avg_risk_score ? r : best
    )
    return {
      repoCount: repos.length,
      avgScore: Math.round(avgScore),
      totalCritical,
      mostAtRisk,
      healthiest,
    }
  }, [repos])

  useEffect(() => {
    setInternalLoading(true)
    setError(null)

    fetch("/api/review/repo-health", {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`请求失败 (HTTP ${res.status})`)
        }
        const data: RepoHealthItem[] = await res.json()
        setRepos(data)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "获取仓库健康数据失败")
      })
      .finally(() => setInternalLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      {/* ---- 区块标题 ---- */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#7c3aed]/10 flex items-center justify-center">
          <Activity size={18} className="text-[#7c3aed]" />
        </div>
        <h3 className="text-base font-semibold text-[#e4e8f1]">仓库健康</h3>
      </div>

      {/* ---- 加载态 ---- */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* ---- 错误态 ---- */}
      {!isLoading && error && (
        <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-8 text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 text-[#ef4444]" />
          <p className="text-[#e4e8f1] font-medium mb-1">加载失败</p>
          <p className="text-sm text-[#7b829c]">{error}</p>
        </div>
      )}

      {/* ---- 空态 ---- */}
      {!isLoading && !error && repos.length === 0 && (
        <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-8 text-center">
          <Shield size={32} className="mx-auto mb-3 text-[#7b829c]" />
          <p className="text-[#e4e8f1] font-medium mb-1">暂无仓库数据</p>
          <p className="text-sm text-[#7b829c]">
            分析 PR 后将自动生成仓库健康报告
          </p>
        </div>
      )}

      {/* ---- 卡片网格 ---- */}
      {!isLoading && !error && repos.length > 0 && (
        <>
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-1">
              <div className="bg-[#131829] border border-[#1e2440] rounded-lg px-4 py-3 text-center">
                <p className="text-[10px] text-[#7b829c] uppercase tracking-wider">仓库数</p>
                <p className="text-lg font-bold text-[#e4e8f1]">{summary.repoCount}</p>
              </div>
              <div className="bg-[#131829] border border-[#1e2440] rounded-lg px-4 py-3 text-center">
                <p className="text-[10px] text-[#7b829c] uppercase tracking-wider">均风险分</p>
                <p className="text-lg font-bold" style={{ color: getScoreColor(summary.avgScore) }}>
                  {summary.avgScore}
                </p>
              </div>
              <div className="bg-[#131829] border border-[#1e2440] rounded-lg px-4 py-3 text-center">
                <p className="text-[10px] text-[#7b829c] uppercase tracking-wider">致命项</p>
                <p className="text-lg font-bold text-[#ef4444]">{summary.totalCritical}</p>
              </div>
              <div className="bg-[#131829] border border-[#1e2440] rounded-lg px-4 py-3 text-center">
                <p className="text-[10px] text-[#7b829c] uppercase tracking-wider">最健康</p>
                <p className="text-xs font-medium text-[#06d6a0] truncate" title={summary.healthiest.full_name}>
                  {summary.healthiest.full_name.split("/").pop()}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#4a5178] uppercase tracking-wider">排序:</span>
            {[
              { key: "risk" as const, label: "风险从高到低" },
              { key: "prs" as const, label: "PR 数量" },
              { key: "recent" as const, label: "最近分析" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`text-[10px] px-2 py-1 rounded-md transition-all ${
                  sortBy === opt.key
                    ? "bg-[#06d6a0]/15 text-[#06d6a0] font-medium"
                    : "text-[#7b829c] hover:text-[#e4e8f1] hover:bg-[#1e2440]/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sortedRepos.map((repo, idx) => {
            const scoreColor = getScoreColor(repo.avg_risk_score)

            return (
              <div
                key={repo.full_name}
                className={cn(
                  "group relative bg-[#131829] border border-[#1e2440] rounded-xl p-5",
                  "transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01]",
                  "animate-fade-in-up",
                  `stagger-${(idx % 5) + 1}`
                )}
              >
                {/* 悬停微光 */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 25% 40%, ${scoreColor}08, transparent 55%)`,
                  }}
                />

                <div className="relative">
                  {/* 主内容：仪表 + 信息 */}
                  <div className="flex gap-4">
                    {/* 左：分值弧 */}
                    <ScoreGauge score={repo.avg_risk_score} />

                    {/* 右：仓库信息 */}
                    <div className="flex-1 min-w-0">
                      {/* 仓库名 */}
                      <h4 className="text-sm font-semibold text-[#e4e8f1] truncate leading-snug">
                        {repo.full_name}
                      </h4>

                      {/* PR 数量徽章 */}
                      <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-[#1e2440]/60 text-[11px] text-[#7b829c]">
                        <GitPullRequest size={12} />
                        <span className="font-medium text-[#e4e8f1]">
                          {repo.total_prs}
                        </span>
                        <span>PRs</span>
                      </div>

                      {/* 风险分布条 */}
                      <SeverityBars item={repo} />
                    </div>
                  </div>

                  {/* 底部分隔 + 最近分析时间 */}
                  {repo.last_analysis_at && (
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#1e2440]/50">
                      <Clock size={12} className="text-[#7b829c]" />
                      <span className="text-[11px] text-[#7b829c]">
                        最近分析: {daysAgo(repo.last_analysis_at)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        </>
      )}
    </div>
  )
}
