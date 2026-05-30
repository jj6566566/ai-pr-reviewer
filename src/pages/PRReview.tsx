import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  GitBranch,
  FileCode,
  Clock,
  AlertTriangle,
  Lightbulb,
  Bug,
  Check,
  ExternalLink,
  Loader2,
  GitPullRequest,
  Zap,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react"
import type {
  HistoryItem,
  HistoryDetail,
  RiskItem,
  SuggestionItem,
} from "@/types/review"
import { RISK_SEVERITY_CONFIG, RISK_LEVEL_CONFIG, SEVERITY_ORDER } from "@/types/review"
import { fetchHistory, fetchHistoryDetail, submitFeedback } from "@/api/review"
import ReviewChat from "@/components/ReviewChat"
import DiffViewer from "@/components/DiffViewer"

const riskLevelOptions = [
  { value: "all", label: "全部等级" },
  { value: "critical", label: "严重" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
]

const severityIcons: Record<string, typeof Bug> = {
  critical: Bug,
  high: AlertTriangle,
  medium: Lightbulb,
  low: Lightbulb,
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return "刚刚"
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} 天前`
  return `${Math.floor(diffDays / 7)} 周前`
}

export default function PRReview() {
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [riskLevelFilter, setRiskLevelFilter] = useState("all")
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [detailMap, setDetailMap] = useState<Record<number, HistoryDetail>>({})
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    setLoading(true)
    fetchHistory(50)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.pr_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.pr_number.toString().includes(searchQuery.trim()) ||
        `${item.repo_owner}/${item.repo_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.author.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesRisk =
        riskLevelFilter === "all" || item.risk_level === riskLevelFilter

      return matchesSearch && matchesRisk
    })
  }, [items, searchQuery, riskLevelFilter])

  const toggleExpand = async (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        return next
      }
      next.add(id)
      return next
    })
    if (detailMap[id]) return
    setLoadingIds((prev) => new Set(prev).add(id))
    try {
      const d = await fetchHistoryDetail(id)
      setDetailMap((prev) => ({ ...prev, [id]: d }))
    } catch {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      })
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  useEffect(() => {
    const idParam = searchParams.get("id")
    if (idParam && items.length > 0) {
      const id = parseInt(idParam, 10)
      const found = items.find((item) => item.id === id)
      if (found) {
        toggleExpand(id)
      }
    }
  }, [searchParams, items])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#e4e8f1]">评审队列</h2>
        <p className="text-sm text-[#7b829c] mt-1">
          查看已完成的 AI 代码评审记录，回顾风险项与改进建议
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[360px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5178] pointer-events-none"
          />
          <input
            type="text"
            placeholder="搜索 PR 标题、仓库或作者..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] placeholder-[#4a5178] focus:outline-none focus:border-[#06d6a0] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[#4a5178]" />
          {riskLevelOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRiskLevelFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                riskLevelFilter === opt.value
                  ? "bg-[#06d6a0]/10 border-[#06d6a0]/40 text-[#06d6a0]"
                  : "bg-[#0f1324] border-[#1e2440] text-[#7b829c] hover:text-[#e4e8f1] hover:border-[#2d3560]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center text-[#7b829c]">
          <Loader2 size={32} className="mx-auto mb-3 animate-spin" />
          <p className="text-sm">正在加载评审记录...</p>
        </div>
      )}

      {!loading && filteredItems.length === 0 && (
        <div className="py-16 text-center text-[#7b829c]">
          <GitPullRequest size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">
            {items.length === 0
              ? "暂无评审记录，先去「PR 分析」中分析代码吧"
              : "没有找到匹配的评审记录"}
          </p>
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const levelConfig = RISK_LEVEL_CONFIG[item.risk_level]
            const isExpanded = expandedIds.has(item.id)
            const detail = detailMap[item.id]
            const isLoading = loadingIds.has(item.id)
            return (
              <div
                key={item.id}
                className="bg-[#131829] border border-[#1e2440] rounded-xl overflow-hidden transition-all duration-300 hover:border-[#06d6a0]/20"
              >
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://github.com/${item.repo_owner}/${item.repo_name}/pull/${item.pr_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-semibold text-[#58a6ff] hover:underline truncate flex items-center gap-1"
                      >
                        #{item.pr_number} {item.pr_title}
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[#7b829c]">
                      <span>
                        {item.repo_owner}/{item.repo_name}
                      </span>
                      <span>{item.author}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {timeAgo(item.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileCode size={11} />
                        {item.files_changed} 文件
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-3">
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${levelConfig.bgClass} ${levelConfig.textClass}`}
                    >
                      {item.risk_score}
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={16} className="text-[#7b829c]" />
                    ) : (
                      <ChevronDown size={16} className="text-[#7b829c]" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#1e2440] bg-[#0a0e1a] p-5">
                    {isLoading && (
                      <div className="py-8 text-center text-[#7b829c]">
                        <Loader2 size={24} className="mx-auto mb-2 animate-spin" />
                        <p className="text-sm">加载详情...</p>
                      </div>
                    )}

                    {detail && !isLoading && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#7b829c]">
                          <span className="flex items-center gap-1">
                            <GitBranch size={12} />
                            {detail.head_branch} → {detail.base_branch}
                          </span>
                          <span className="text-[#06d6a0]">+{detail.additions}</span>
                          <span className="text-[#ef4444]">-{detail.deletions}</span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {detail.estimated_review_minutes} 分钟
                          </span>
                        </div>

                        {detail.summary && (
                          <div className="p-3 bg-[#131829] border border-[#1e2440] rounded-lg">
                            <p className="text-sm text-[#e4e8f1] leading-relaxed">
                              {detail.summary}
                            </p>
                          </div>
                        )}

                        {detail.risk_items.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-[#ef4444] mb-2">
                              风险项 ({detail.risk_items.length})
                            </h5>
                            <div className="space-y-2">
                              {[...detail.risk_items]
                                .sort(
                                  (a, b) =>
                                    SEVERITY_ORDER[a.severity] -
                                    SEVERITY_ORDER[b.severity]
                                )
                                .map((risk, i) => {
                                  const sevConfig =
                                    RISK_SEVERITY_CONFIG[risk.severity]
                                  const Icon = severityIcons[risk.severity]
                                  const fbKey = `risk_item_${i}`
                                  const fb = detail.feedback?.[fbKey]
                                  return (
                                    <div
                                      key={i}
                                      className="group p-3 rounded-lg border bg-[#131829]"
                                      style={{
                                        borderColor: `${sevConfig.color}30`,
                                      }}
                                    >
                                      <div className="flex items-start gap-2">
                                        <Icon
                                          size={14}
                                          style={{ color: sevConfig.color }}
                                          className="flex-shrink-0 mt-0.5"
                                        />
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span
                                              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                              style={{
                                                backgroundColor: `${sevConfig.color}20`,
                                                color: sevConfig.color,
                                              }}
                                            >
                                              {sevConfig.label}
                                            </span>
                                            <span className="text-xs text-[#7b829c] font-mono">
                                              {risk.file}:{risk.line}
                                            </span>
                                            {risk.confidence !== undefined && (
                                              <span className="text-[10px] text-[#7b829c] opacity-60">
                                                {Math.round(risk.confidence * 100)}%
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-sm text-[#e4e8f1]">
                                            {risk.description}
                                          </p>
                                          {risk.suggestion && (
                                            <p className="mt-1 text-xs text-[#06d6a0]">
                                              建议: {risk.suggestion}
                                            </p>
                                          )}
                                          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            <button
                                              onClick={() => submitFeedback(detail.id, [{ index: i, verdict: "accepted", category: "risk_item" }])}
                                              className={`p-1 rounded-md transition-all ${
                                                fb?.verdict === "accepted"
                                                  ? "bg-[#06d6a0]/20 text-[#06d6a0]"
                                                  : "text-[#4a5178] hover:text-[#06d6a0] hover:bg-[#06d6a0]/10"
                                              }`}
                                              title="采纳"
                                            >
                                              <ThumbsUp size={13} />
                                            </button>
                                            <button
                                              onClick={() => submitFeedback(detail.id, [{ index: i, verdict: "false_positive", category: "risk_item" }])}
                                              className={`p-1 rounded-md transition-all ${
                                                fb?.verdict === "false_positive"
                                                  ? "bg-[#ef4444]/20 text-[#ef4444]"
                                                  : "text-[#4a5178] hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                                              }`}
                                              title="误报"
                                            >
                                              <ThumbsDown size={13} />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        )}

                        {detail.suggestions.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-[#3b82f6] mb-2">
                              改进建议 ({detail.suggestions.length})
                            </h5>
                            <div className="space-y-2">
                              {detail.suggestions.map((s, i) => {
                                const fbKey = `suggestion_${i}`
                                const fb = detail.feedback?.[fbKey]
                                return (
                                  <div
                                    key={i}
                                    className="group p-3 rounded-lg border border-[#1e2440] bg-[#131829]"
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <Zap
                                        size={12}
                                        className="text-[#3b82f6]"
                                      />
                                      <span className="text-xs text-[#7b829c] font-mono">
                                        {s.file}
                                      </span>
                                    </div>
                                    <p className="text-sm text-[#e4e8f1]">
                                      {s.description}
                                    </p>
                                    {s.code_snippet && (
                                      <div className="mt-2 p-2 bg-[#0a0e1a] border border-[#1e2440] rounded">
                                        <pre className="text-xs text-[#06d6a0] font-mono whitespace-pre-wrap overflow-x-auto">
                                          {s.code_snippet}
                                        </pre>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                      <button
                                        onClick={() => submitFeedback(detail.id, [{ index: i, verdict: "helpful", category: "suggestion" }])}
                                        className={`p-1 rounded-md transition-all ${
                                          fb?.verdict === "helpful"
                                            ? "bg-[#06d6a0]/20 text-[#06d6a0]"
                                            : "text-[#4a5178] hover:text-[#06d6a0] hover:bg-[#06d6a0]/10"
                                        }`}
                                        title="有帮助"
                                      >
                                        <ThumbsUp size={13} />
                                      </button>
                                      <button
                                        onClick={() => submitFeedback(detail.id, [{ index: i, verdict: "not_helpful", category: "suggestion" }])}
                                        className={`p-1 rounded-md transition-all ${
                                          fb?.verdict === "not_helpful"
                                            ? "bg-[#ef4444]/20 text-[#ef4444]"
                                            : "text-[#4a5178] hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                                        }`}
                                        title="无帮助"
                                      >
                                        <ThumbsDown size={13} />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {detail.diff_content && (
                          <div>
                            <h5 className="text-xs font-semibold text-[#06d6a0] mb-2">
                              Diff 视图
                            </h5>
                            <DiffViewer
                              diffContent={detail.diff_content}
                              riskItems={detail.risk_items}
                            />
                          </div>
                        )}
                        {detail && (
                          <ReviewChat
                            analysisId={detail.id}
                            repoOwner={detail.repo_owner}
                            repoName={detail.repo_name}
                            prTitle={detail.pr_title}
                            summary={detail.summary}
                            riskItems={detail.risk_items}
                            suggestions={detail.suggestions}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
