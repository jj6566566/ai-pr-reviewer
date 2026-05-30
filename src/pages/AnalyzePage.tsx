import { useState, useRef, useCallback, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Loader2,
  Shield,
  Zap,
  Lightbulb,
  Bug,
  AlertTriangle,
  GitBranch,
  Clock,
  FileCode,
  Plus,
  Minus,
  Check,
  X,
  RotateCcw,
  ExternalLink,
  Layers,
  BarChart3,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Target,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  StopCircle,
  Play,
} from "lucide-react"
import type {
  AnalyzeResponse,
  HistoryDetail,
  RiskItem,
  SuggestionItem,
  RuleMatch,
  BatchAnalyzeResponse,
} from "@/types/review"
import { RISK_SEVERITY_CONFIG, RISK_LEVEL_CONFIG, SEVERITY_ORDER } from "@/types/review"
import { analyzePR, analyzeBatch, analyzeBatchStream, analyzePRStream, submitFeedback, fetchHistoryDetail } from "@/api/review"
import { useAuth } from "@/contexts/AuthContext"
import RepoSelector from "@/components/RepoSelector"
import PRList from "@/components/PRList"
import ReviewChat from "@/components/ReviewChat"
import DiffViewer from "@/components/DiffViewer"
import IntentCheckCard from "@/components/IntentCheckCard"
import PRReview from "@/pages/PRReview"

const severityIcons: Record<string, typeof Bug> = {
  critical: Bug,
  high: AlertTriangle,
  medium: Lightbulb,
  low: Lightbulb,
}

type AnalysisMode = "single" | "batch"
type FeedbackState = Record<string, "accepted" | "false_positive" | "helpful" | "not_helpful">

function RiskList({ risks, feedback, analysisId, highlightedIdx, onFeedbackChange }: { risks: RiskItem[]; feedback: FeedbackState; analysisId?: number; highlightedIdx?: number | null; onFeedbackChange?: () => void }) {
  const handleFeedback = async (idx: number, verdict: "accepted" | "false_positive") => {
    if (!analysisId) return
    try {
      await submitFeedback(analysisId, [
        { index: idx, verdict, category: "risk_item" },
      ])
      onFeedbackChange?.()
    } catch {}
  }

  if (risks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#7b829c]">
        <div className="w-12 h-12 rounded-full bg-[#06d6a0]/10 flex items-center justify-center mb-3">
          <Check size={24} className="text-[#06d6a0]" />
        </div>
        <p className="text-sm font-medium">AI 未发现显著风险项</p>
        <p className="text-xs mt-1 opacity-60">代码质量良好</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {risks.map((risk, i) => {
        const sevConfig = RISK_SEVERITY_CONFIG[risk.severity]
        const Icon = severityIcons[risk.severity]
        const fbKey = `risk_item_${i}`
        const fb = feedback[fbKey]
        const isFalsePositive = risk.is_false_positive

        return (
          <div
            key={i}
            data-risk-idx={i}
            className={`group relative p-4 rounded-xl border transition-all duration-300 hover:-translate-y-0.5 ${
              isFalsePositive ? "border-[#f59e0b]/20 bg-[#f59e0b]/2" : ""
            } ${highlightedIdx === i ? "ring-2 ring-[#06d6a0]/50 scale-[1.02]" : ""}`}
            style={{ borderColor: isFalsePositive ? "rgba(245,158,11,0.2)" : `${sevConfig.color}25`, backgroundColor: isFalsePositive ? "rgba(245,158,11,0.03)" : "#0a0e1a" }}
          >
            {isFalsePositive && (
              <div className="absolute top-0 right-0">
                <span className="text-[10px] px-2 py-0.5 bg-[#f59e0b]/10 text-[#f59e0b] rounded-bl-lg rounded-tr-xl border border-[#f59e0b]/20">
                  疑似误报
                </span>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${sevConfig.color}15` }}>
                <Icon size={15} style={{ color: sevConfig.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold tracking-wide uppercase"
                    style={{ backgroundColor: `${sevConfig.color}20`, color: sevConfig.color }}
                  >
                    {sevConfig.label}
                  </span>
                  {risk.confidence !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                      risk.confidence >= 0.8 ? "bg-[#06d6a0]/10 text-[#06d6a0]" :
                      risk.confidence >= 0.5 ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                      "bg-[#ef4444]/10 text-[#ef4444]"
                    }`}>
                      置信度: {Math.round(risk.confidence * 100)}%
                    </span>
                  )}
                  <span className="text-[11px] text-[#7b829c] font-mono">
                    {risk.file}:{risk.line}
                  </span>
                </div>
                <p className="text-sm font-medium text-[#e4e8f1] leading-relaxed">{risk.description}</p>
                {risk.suggestion && (
                  <div className="mt-2 p-3 bg-[#06d6a0]/3 border border-[#06d6a0]/10 rounded-lg">
                    <p className="text-[11px] text-[#06d6a0] font-semibold mb-1 flex items-center gap-1">
                      <Lightbulb size={11} /> 修复建议
                    </p>
                    <p className="text-xs text-[#b8c4d8] leading-relaxed">{risk.suggestion}</p>
                  </div>
                )}

                {analysisId !== undefined && (
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => handleFeedback(i, "accepted")}
                      className={`p-1 rounded-md transition-all ${
                        fb === "accepted"
                          ? "bg-[#06d6a0]/20 text-[#06d6a0]"
                          : "text-[#4a5178] hover:text-[#06d6a0] hover:bg-[#06d6a0]/10"
                      }`}
                      title="采纳"
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      onClick={() => handleFeedback(i, "false_positive")}
                      className={`p-1 rounded-md transition-all ${
                        fb === "false_positive"
                          ? "bg-[#ef4444]/20 text-[#ef4444]"
                          : "text-[#4a5178] hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                      }`}
                      title="误报"
                    >
                      <ThumbsDown size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SuggestionList({ suggestions, feedback, analysisId, onFeedbackChange }: { suggestions: SuggestionItem[]; feedback: FeedbackState; analysisId?: number; onFeedbackChange?: () => void }) {
  const handleFeedback = async (idx: number, verdict: "helpful" | "not_helpful") => {
    if (!analysisId) return
    try {
      await submitFeedback(analysisId, [
        { index: idx, verdict, category: "suggestion" },
      ])
      onFeedbackChange?.()
    } catch {}
  }

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#7b829c]">
        <div className="w-12 h-12 rounded-full bg-[#3b82f6]/10 flex items-center justify-center mb-3">
          <Check size={24} className="text-[#3b82f6]" />
        </div>
        <p className="text-sm font-medium">暂无改进建议</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s, i) => {
        const catMap: Record<string, { color: string; icon: typeof Lightbulb; label: string }> = {
          security: { color: "#ef4444", icon: Bug, label: "安全" },
          performance: { color: "#7c3aed", icon: Zap, label: "性能" },
          maintainability: { color: "#3b82f6", icon: Lightbulb, label: "可维护" },
          "best-practice": { color: "#06d6a0", icon: Lightbulb, label: "最佳实践" },
          "bug-risk": { color: "#f59e0b", icon: Bug, label: "缺陷风险" },
        }
        const cfg = catMap[s.category] || catMap["maintainability"]
        const CIcon = cfg.icon
        const fbKey = `suggestion_${i}`
        const fb = feedback[fbKey]

        return (
          <div key={i} className="group p-4 rounded-xl border border-[#1e2440] bg-[#0a0e1a] hover:border-[#2d3560] transition-all duration-300">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cfg.color}15` }}>
                <CIcon size={15} style={{ color: cfg.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span className="text-[11px] text-[#7b829c] font-mono">{s.file}</span>
                  {s.confidence !== undefined && (
                    <span className="text-[10px] text-[#7b829c] opacity-60">
                      置信度: {Math.round(s.confidence * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#e4e8f1] leading-relaxed">{s.description}</p>
                {s.code_snippet && (
                  <div className="mt-2 p-3 bg-[#0a0e1a] border border-[#1e2440] rounded-lg">
                    <pre className="text-xs text-[#06d6a0] font-mono whitespace-pre-wrap overflow-x-auto">{s.code_snippet}</pre>
                  </div>
                )}

                {analysisId !== undefined && (
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => handleFeedback(i, "helpful")}
                      className={`p-1 rounded-md transition-all ${
                        fb === "helpful"
                          ? "bg-[#06d6a0]/20 text-[#06d6a0]"
                          : "text-[#4a5178] hover:text-[#06d6a0] hover:bg-[#06d6a0]/10"
                      }`}
                      title="有帮助"
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      onClick={() => handleFeedback(i, "not_helpful")}
                      className={`p-1 rounded-md transition-all ${
                        fb === "not_helpful"
                          ? "bg-[#ef4444]/20 text-[#ef4444]"
                          : "text-[#4a5178] hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                      }`}
                      title="无帮助"
                    >
                      <ThumbsDown size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AnalyzePage() {
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuth()
  const [mode, setMode] = useState<AnalysisMode>("single")
  const [owner, setOwner] = useState("")
  const [repo, setRepo] = useState("")
  const [prNumber, setPrNumber] = useState<number | null>(null)
  const [manualPR, setManualPR] = useState("")
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamTokens, setStreamTokens] = useState("")
  const [streamProgress, setStreamProgress] = useState("")
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [error, setError] = useState("")
  const [postComment, setPostComment] = useState(true)
  const [activeTab, setActiveTab] = useState<"risks" | "suggestions" | "rules" | "diff">("risks")
  const [highlightedRiskIdx, setHighlightedRiskIdx] = useState<number | null>(null)
  const cancelFn = useRef<(() => void) | null>(null)

  const [selectedPRs, setSelectedPRs] = useState<number[]>([])
  const [batchResult, setBatchResult] = useState<BatchAnalyzeResponse | null>(null)
  const [expandedPRs, setExpandedPRs] = useState<Set<number>>(new Set())
  const [detailPR, setDetailPR] = useState<AnalyzeResponse | null>(null)
  const [batchStreamState, setBatchStreamState] = useState<{ current: number; total: number; prNumber: number; stage: string } | null>(null)
  const [batchPRTokens, setBatchPRTokens] = useState<Record<number, string>>({})
  const [batchCompletedPRs, setBatchCompletedPRs] = useState<AnalyzeResponse[]>([])

  const [feedback, setFeedback] = useState<FeedbackState>({})

  useEffect(() => {
    const idParam = searchParams.get("id")
    if (!idParam) return
    const id = parseInt(idParam, 10)
    if (isNaN(id)) return

    setLoading(true)
    fetchHistoryDetail(id)
      .then((detail) => {
        const response: AnalyzeResponse = {
          pr_info: {
            owner: detail.repo_owner,
            repo: detail.repo_name,
            number: detail.pr_number,
            title: detail.pr_title,
            description: detail.pr_description || "",
            author: detail.author,
            base_branch: detail.base_branch,
            head_branch: detail.head_branch,
            files_changed: detail.files_changed,
            additions: detail.additions,
            deletions: detail.deletions,
            files: [],
            diff_content: "",
          },
          summary: detail.summary,
          risk_items: detail.risk_items || [],
          suggestions: detail.suggestions || [],
          rule_matches: [],
          risk_score: detail.risk_score,
          risk_level: detail.risk_level,
          estimated_review_minutes: detail.estimated_review_minutes,
          analysis_id: detail.id,
        }
        setResult(response)
        setOwner(detail.repo_owner)
        setRepo(detail.repo_name)
        setPrNumber(detail.pr_number)
        if (detail.feedback) {
          const fb: FeedbackState = {}
          for (const [key, val] of Object.entries(detail.feedback)) {
            fb[key] = val.verdict as "accepted" | "false_positive" | "helpful" | "not_helpful"
          }
          setFeedback(fb)
        }
      })
      .catch(() => setError("加载历史记录失败"))
      .finally(() => setLoading(false))
  }, [searchParams])

  useEffect(() => {
    const ownerParam = searchParams.get("owner")
    const repoParam = searchParams.get("repo")
    const prParam = searchParams.get("pr")
    if (!ownerParam || !repoParam) return

    setOwner(ownerParam)
    setRepo(repoParam)
    if (prParam) {
      const prNum = parseInt(prParam, 10)
      if (!isNaN(prNum)) setPrNumber(prNum)
    }
  }, [searchParams])

  const canAnalyze = (owner && repo && prNumber !== null) || Boolean(manualPR)
  const canBatchAnalyze = owner && repo && selectedPRs.length >= 2 && selectedPRs.length <= 10

  const handleRepoSelect = (o: string, r: string) => {
    setOwner(o)
    setRepo(r)
    setPrNumber(null)
    setSelectedPRs([])
  }

  const handlePRSelect = (o: string, r: string, num: number) => {
    setOwner(o)
    setRepo(r)
    setPrNumber(num)
  }

  const parseManualURL = () => {
    const match = manualPR.match(/github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)\/pull\/(\d+)/)
    if (match) {
      setOwner(match[1])
      setRepo(match[2])
      setPrNumber(parseInt(match[3]))
      return true
    }
    return false
  }

  const handleCancel = () => {
    cancelFn.current?.()
    cancelFn.current = null
    setStreaming(false)
    setLoading(false)
  }

  const handleAnalyze = async () => {
    setError("")
    setResult(null)
    setStreamTokens("")
    setFeedback({})

    let o = owner
    let r = repo
    let num = prNumber

    if (manualPR && !o) {
      if (!parseManualURL()) {
        setError("请输入有效的 GitHub PR URL")
        return
      }
      o = owner
      r = repo
      num = prNumber
    }

    if (!o || !r || num === null) {
      setError("请选择仓库和 Pull Request")
      return
    }

    setLoading(true)
    setStreaming(true)
    setStreamProgress("正在获取 PR 信息...")

    cancelFn.current = analyzePRStream(
      { owner: o, repo: r, prNumber: num, postComment },
      (progress) => {
        setStreamProgress(`已获取 ${progress.files_changed} 个文件，+${progress.additions}/-${progress.deletions} 行`)
      },
      (token) => {
        setStreamTokens((prev) => prev + token)
        setStreamProgress("AI 正在分析代码...")
      },
      (data) => {
        setResult(data)
        setLoading(false)
        setStreaming(false)
        setStreamProgress("")
        cancelFn.current = null
      },
      (err) => {
        setError(err)
        setLoading(false)
        setStreaming(false)
        setStreamProgress("")
        cancelFn.current = null
      }
    )
  }

  const handleBatchAnalyze = async () => {
    setError("")
    setBatchResult(null)
    setBatchStreamState(null)
    setBatchPRTokens({})
    setBatchCompletedPRs([])

    if (selectedPRs.length < 2 || selectedPRs.length > 10) {
      setError("批量分析需要选择 2-10 个 PR")
      return
    }

    setLoading(true)
    setStreaming(true)

    cancelFn.current = analyzeBatchStream(
      selectedPRs.map((num) => ({ owner, repo, pr_number: num })),
      {
        onProgress: (data) => setBatchStreamState({ current: data.current, total: data.total, prNumber: data.pr_number, stage: data.stage }),
        onToken: (data) => {
          setBatchPRTokens((prev) => {
            const current = prev[data.pr_number] || ""
            return { ...prev, [data.pr_number]: current + data.token }
          })
        },
        onPRComplete: (data) => {
          setBatchCompletedPRs((prev) => {
            const updated = [...prev.filter((r) => r.pr_info.number !== data.pr_number), data.result]
            return updated.sort((a, b) => a.pr_info.number - b.pr_info.number)
          })
        },
        onComplete: (data) => {
          setBatchResult(data)
          setLoading(false)
          setStreaming(false)
          setBatchStreamState(null)
          setBatchPRTokens({})
          const allPRNumbers = new Set(data.results.map((r) => r.pr_info.number))
          setExpandedPRs(allPRNumbers)
          cancelFn.current = null
        },
        onError: (data) => {
          setError(data.error)
          setLoading(false)
          setStreaming(false)
          setBatchStreamState(null)
          cancelFn.current = null
        },
      },
      undefined,
      postComment
    )
  }

  const handleReset = () => {
    setResult(null)
    setBatchResult(null)
    setDetailPR(null)
    setError("")
    setManualPR("")
    setSelectedPRs([])
    setExpandedPRs(new Set())
    setStreamTokens("")
    setStreamProgress("")
    setFeedback({})
    setBatchStreamState(null)
    setBatchPRTokens({})
    setBatchCompletedPRs([])
    handleCancel()
  }

  const toggleExpand = (prNum: number) => {
    setExpandedPRs((prev) => {
      const next = new Set(prev)
      if (next.has(prNum)) {
        next.delete(prNum)
      } else {
        next.add(prNum)
      }
      return next
    })
  }

  const sortedRisks = result?.risk_items
    ? [...result.risk_items].sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      )
    : []

  const riskScore = result?.risk_score ?? 0
  const riskLevel = result?.risk_level ?? "low"
  const levelConfig = RISK_LEVEL_CONFIG[riskLevel]

  const hasResult = result || batchResult

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-[#e4e8f1] flex items-center gap-2">
          <Sparkles size={22} className="text-[#06d6a0]" />
          PR 分析
        </h2>
        <p className="text-sm text-[#7b829c] mt-1.5">选择仓库和 Pull Request，AI 将自动进行深度代码评审</p>
      </div>

      {!hasResult && (
        <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-6 shadow-lg shadow-black/20">
          <div className="flex items-center gap-1.5 mb-6 p-1 bg-[#0a0e1a] rounded-lg border border-[#1e2440] w-fit">
            <button
              onClick={() => setMode("single")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 ${
                mode === "single"
                  ? "bg-[#06d6a0]/15 text-[#06d6a0] shadow-sm shadow-[#06d6a0]/5"
                  : "text-[#7b829c] hover:text-[#e4e8f1]"
              }`}
            >
              <Target size={16} />
              单个 PR 分析
            </button>
            <button
              onClick={() => setMode("batch")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 ${
                mode === "batch"
                  ? "bg-[#7c3aed]/15 text-[#7c3aed] shadow-sm shadow-[#7c3aed]/5"
                  : "text-[#7b829c] hover:text-[#e4e8f1]"
              }`}
            >
              <Layers size={16} />
              批量 PR 分析
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-[#7b829c] mb-2 uppercase tracking-wider">
                选择仓库
              </label>
              <RepoSelector onSelect={handleRepoSelect} disabled={!isAuthenticated} />
              {!isAuthenticated && (
                <p className="mt-2 text-xs text-[#f59e0b] flex items-center gap-1">
                  <AlertTriangle size={11} />
                  请先登录 GitHub 账号
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#7b829c] mb-2 uppercase tracking-wider">
                {owner && repo
                  ? mode === "batch"
                    ? `${owner}/${repo} · PR 列表（多选）`
                    : `${owner}/${repo} · PR 列表`
                  : "选择 PR"}
              </label>
              <PRList
                owner={owner}
                repo={repo}
                onSelectPR={handlePRSelect}
                multiSelect={mode === "batch"}
                selectedPRs={selectedPRs}
                onSelectionChange={setSelectedPRs}
              />
              {mode === "batch" && selectedPRs.length > 0 && (
                <div className="mt-2 px-3 py-1.5 bg-[#7c3aed]/5 border border-[#7c3aed]/15 rounded-lg text-xs text-[#7c3aed] flex items-center gap-1">
                  <Layers size={12} />
                  已选择 <span className="font-bold">{selectedPRs.length}</span> 个 PR
                  {selectedPRs.length < 2 && (
                    <span className="text-[#f59e0b]">（至少选择 2 个）</span>
                  )}
                  {selectedPRs.length > 10 && (
                    <span className="text-[#f59e0b]">（最多选择 10 个）</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {mode === "single" && (
            <div className="mt-6 pt-6 border-t border-[#1e2440]">
              <label className="block text-xs font-semibold text-[#7b829c] mb-2 uppercase tracking-wider">
                或直接粘贴 PR 链接
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="https://github.com/owner/repo/pull/123"
                  value={manualPR}
                  onChange={(e) => setManualPR(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canAnalyze) handleAnalyze() }}
                  className="flex-1 h-10 px-4 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] placeholder-[#4a5178] focus:outline-none focus:border-[#06d6a0] focus:ring-1 focus:ring-[#06d6a0]/30 transition-all"
                />
              </div>
            </div>
          )}

          {mode === "single" && prNumber && (
            <div className="mt-4 px-4 py-2.5 bg-[#06d6a0]/3 border border-[#06d6a0]/15 rounded-lg text-sm text-[#06d6a0] flex items-center gap-2">
              <GitBranch size={14} />
              {owner}/{repo} <span className="font-bold text-white">#{prNumber}</span>
            </div>
          )}

          {error && (
            <div className="mt-4 px-4 py-2.5 bg-[#ef4444]/5 border border-[#ef4444]/20 rounded-lg text-sm text-[#ef4444] flex items-center gap-2">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={postComment}
                  onChange={(e) => setPostComment(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-5 rounded-full transition-colors duration-200 ${postComment ? "bg-[#06d6a0]" : "bg-[#2d3560]"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${postComment ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
              </div>
              <span className="text-xs text-[#b8c4d8]">分析完成后发布评论到 PR</span>
            </label>
          </div>

          <div className="flex gap-3 mt-4">
            {mode === "single" && (
              <button
                onClick={handleAnalyze}
                disabled={(!canAnalyze || loading) && !streaming}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#06d6a0] to-[#05b88a] text-[#0a0e1a] rounded-lg hover:from-[#05c090] hover:to-[#04a378] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-[#06d6a0]/20"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {streaming ? "AI 分析中..." : "准备中..."}
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    开始 AI 分析
                  </>
                )}
              </button>
            )}
            {streaming && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#ef4444] bg-[#ef4444]/5 border border-[#ef4444]/20 rounded-lg hover:bg-[#ef4444]/10 transition-all"
              >
                <StopCircle size={16} />
                取消
              </button>
            )}
            {mode === "batch" && (
              <button
                onClick={handleBatchAnalyze}
                disabled={!canBatchAnalyze || loading}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white rounded-lg hover:from-[#6d28d9] hover:to-[#5b21b6] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-[#7c3aed]/20"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    批量分析中...
                  </>
                ) : (
                  <>
                    <Layers size={16} />
                    批量分析 ({selectedPRs.length} 个 PR)
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {streaming && (
        <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-8 shadow-lg shadow-black/20">
          {mode === "single" ? (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[#06d6a0]/10 flex items-center justify-center">
                      <Sparkles size={20} className="text-[#06d6a0] animate-pulse" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#06d6a0] flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#e4e8f1]">AI 正在分析</p>
                    <p className="text-xs text-[#7b829c]">{streamProgress || "初始化..."}</p>
                  </div>
                </div>
                <button onClick={handleCancel}
                  className="px-3 py-1.5 text-xs font-medium text-[#7b829c] border border-[#2d3560] rounded-lg hover:text-[#ef4444] hover:border-[#ef4444]/30 transition-all">
                  取消分析
                </button>
              </div>
              <div className="w-full bg-[#0a0e1a] rounded-full h-1.5 mb-4 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#06d6a0] to-[#7c3aed] animate-pulse"
                  style={{ width: streamTokens.length > 0 ? `${Math.min(streamTokens.length / 20 + 10, 95)}%` : "10%", transition: "width 1s ease-in-out" }} />
              </div>
              {streamTokens.length > 0 && (
                <div className="p-4 bg-[#0a0e1a] border border-[#1e2440] rounded-lg max-h-56 overflow-y-auto">
                  <pre className="text-xs text-[#b8c4d8] font-mono whitespace-pre-wrap leading-relaxed">
                    {streamTokens}
                    <span className="inline-block w-2 h-4 bg-[#06d6a0] animate-pulse ml-0.5 align-middle" />
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[#7c3aed]/10 flex items-center justify-center">
                      <Layers size={20} className="text-[#7c3aed] animate-pulse" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#7c3aed] flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#e4e8f1]">批量分析进行中</p>
                    <p className="text-xs text-[#7b829c]">
                      {batchStreamState
                        ? `正在分析 #${batchStreamState.prNumber}（${batchStreamState.current}/${batchStreamState.total}）`
                        : "初始化..."}
                    </p>
                  </div>
                </div>
                <button onClick={handleCancel}
                  className="px-3 py-1.5 text-xs font-medium text-[#7b829c] border border-[#2d3560] rounded-lg hover:text-[#ef4444] hover:border-[#ef4444]/30 transition-all">
                  取消分析
                </button>
              </div>

              <div className="w-full bg-[#0a0e1a] rounded-full h-2 mb-6 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#06d6a0] transition-all duration-700"
                  style={{ width: batchStreamState ? `${(batchStreamState.current / batchStreamState.total) * 100}%` : "5%" }} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {[...selectedPRs].sort((a, b) => a - b).map((prNum) => {
                  const isCompleted = batchCompletedPRs.some((r) => r.pr_info.number === prNum)
                  const isCurrent = batchStreamState?.prNumber === prNum && !isCompleted
                  const token = batchPRTokens[prNum] || ""
                  return (
                    <div key={prNum} className={`p-4 rounded-xl border transition-all duration-300 ${
                      isCompleted
                        ? "border-[#06d6a0]/20 bg-[#06d6a0]/3"
                        : isCurrent
                        ? "border-[#7c3aed]/40 bg-[#7c3aed]/5 animate-pulse"
                        : "border-[#1e2440] bg-[#0a0e1a] opacity-40"
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-[#58a6ff]">#{prNum}</span>
                        {isCompleted && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#06d6a0]/10 text-[#06d6a0] border border-[#06d6a0]/20">
                            ✓ 完成
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/20 animate-pulse">
                            AI 分析中...
                          </span>
                        )}
                        {!isCompleted && !isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1e2440] text-[#7b829c]">
                            等待中
                          </span>
                        )}
                      </div>
                      {token.length > 0 && (
                        <div className="p-2 bg-[#0a0e1a] border border-[#1e2440] rounded-lg max-h-24 overflow-y-auto">
                          <pre className="text-[10px] text-[#b8c4d8] font-mono whitespace-pre-wrap leading-relaxed">
                            {token.slice(-300)}
                            {isCurrent && <span className="inline-block w-1.5 h-3 bg-[#7c3aed] animate-pulse ml-0.5 align-middle" />}
                          </pre>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && !streaming && !hasResult && (
        <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-12 text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-[#1e2440] rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-[#06d6a0] rounded-full animate-spin" />
            <div className="absolute inset-2 border-4 border-transparent border-t-[#7c3aed] rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          </div>
          <p className="text-lg font-medium text-[#e4e8f1]">AI 正在分析代码...</p>
          <p className="text-sm text-[#7b829c] mt-1">正在检查代码质量、安全漏洞、性能问题等</p>
        </div>
      )}

      {result && (
        <>
          <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-6 shadow-lg shadow-black/20">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <a
                    href={`https://github.com/${result.pr_info.owner}/${result.pr_info.repo}/pull/${result.pr_info.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-bold text-[#58a6ff] hover:underline flex items-center gap-1.5 group"
                  >
                    {result.pr_info.title}
                    <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#7b829c]">
                  <span className="flex items-center gap-1">
                    <GitBranch size={12} />
                    {result.pr_info.head_branch} → {result.pr_info.base_branch}
                  </span>
                  <span>{result.pr_info.author}</span>
                  <span className="flex items-center gap-1">
                    <FileCode size={12} />
                    {result.pr_info.files_changed} 文件
                  </span>
                  <span className="text-[#06d6a0] font-medium">+{result.pr_info.additions}</span>
                  <span className="text-[#ef4444] font-medium">-{result.pr_info.deletions}</span>
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center gap-5">
                <div className="text-center">
                  <div
                    className={`relative w-[72px] h-[72px] rounded-full flex items-center justify-center border-2 ${levelConfig.bgClass} ${levelConfig.textClass} mx-auto`}
                  >
                    <div className="absolute inset-0 rounded-full opacity-20 blur-sm" style={{ backgroundColor: levelConfig.textClass.replace("text-", "") }} />
                    <span className="text-2xl font-bold relative z-10">{riskScore}</span>
                  </div>
                  <p className="text-[10px] text-[#7b829c] mt-1.5 uppercase tracking-wider">风险评分</p>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 rounded-full bg-[#0a0e1a] border border-[#1e2440] flex items-center justify-center mx-auto">
                    <Clock size={18} className="text-[#7b829c]" />
                  </div>
                  <p className="text-[10px] text-[#7b829c] mt-1.5 uppercase tracking-wider">
                    {result.estimated_review_minutes} 分钟
                  </p>
                </div>

                {result.analysis_id && (
                  <div className="text-center">
                    <span className={`text-[10px] px-2 py-1 rounded-md font-medium ${levelConfig.bgClass} ${levelConfig.textClass}`}>
                      {levelConfig.label}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {result.summary && (
              <div className="mt-5 p-4 bg-[#0a0e1a] border border-[#1e2440] rounded-lg">
                <p className="text-sm text-[#e4e8f1] leading-relaxed whitespace-pre-line">{result.summary}</p>
              </div>
            )}
          </div>

          {result.intent_check && (
            <div className="mt-4">
              <IntentCheckCard data={result.intent_check} />
            </div>
          )}

          <div className="bg-[#131829] border border-[#1e2440] rounded-xl overflow-hidden shadow-lg shadow-black/20">
            <div className="flex border-b border-[#1e2440] bg-[#0a0e1a]/50">
              {[
                { key: "risks", label: "风险项", count: result.risk_items.length, color: "#ef4444", icon: Shield },
                { key: "suggestions", label: "改进建议", count: result.suggestions.length, color: "#3b82f6", icon: Zap },
                { key: "rules", label: "规则命中", count: result.rule_matches.length, color: "#7c3aed", icon: Target },
                { key: "diff", label: "Diff 视图", count: 0, color: "#06d6a0", icon: FileCode },
              ].map((tab) => {
                const TabIcon = tab.icon
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-[1px] ${
                      activeTab === tab.key
                        ? "border-[#06d6a0] text-[#e4e8f1] bg-[#06d6a0]/3"
                        : "border-transparent text-[#7b829c] hover:text-[#e4e8f1] hover:bg-[#ffffff]/2"
                    }`}
                  >
                    <TabIcon size={14} />
                    {tab.label}
                    {tab.count > 0 && (
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-bold rounded-full"
                        style={{ backgroundColor: `${tab.color}20`, color: tab.color }}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="p-5 h-[500px] overflow-y-auto">
              <div className={activeTab === "risks" ? "" : "hidden"}>
                <RiskList risks={sortedRisks} feedback={feedback} analysisId={result.analysis_id} highlightedIdx={highlightedRiskIdx} onFeedbackChange={() => setFeedback({ ...feedback })} />
              </div>
              <div className={activeTab === "suggestions" ? "" : "hidden"}>
                <SuggestionList suggestions={result.suggestions} feedback={feedback} analysisId={result.analysis_id} onFeedbackChange={() => setFeedback({ ...feedback })} />
              </div>
              <div className={activeTab === "rules" ? "" : "hidden"}>
                <RuleMatchesView matches={result.rule_matches} />
              </div>
              <div className={activeTab === "diff" ? "" : "hidden"}>
                <DiffViewer
                  diffContent={result.pr_info.diff_content}
                  riskItems={result.risk_items}
                  highlightedRiskIdx={highlightedRiskIdx}
                  onRiskClick={(idx) => {
                    setHighlightedRiskIdx(idx)
                    setActiveTab("risks")
                    setTimeout(() => {
                      const el = document.querySelector(`[data-risk-idx="${idx}"]`)
                      el?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }, 100)
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {result && result.analysis_id && (
        <ReviewChat
          analysisId={result.analysis_id}
          repoOwner={result.pr_info.owner}
          repoName={result.pr_info.repo}
          prTitle={result.pr_info.title}
          summary={result.summary}
          riskItems={result.risk_items}
          suggestions={result.suggestions}
        />
      )}

      {batchResult && (
        <>
          <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-6 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#7c3aed]/10 flex items-center justify-center">
                  <BarChart3 size={20} className="text-[#7c3aed]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#e4e8f1]">批量分析概览</h3>
                  <p className="text-xs text-[#7b829c]">{batchResult.overview.total_prs} 个 PR · 均分 {batchResult.overview.avg_risk_score}</p>
                </div>
              </div>
              {batchResult.overview.highest_risk_pr && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#0a0e1a] border border-[#ef4444]/20 rounded-lg">
                  <AlertTriangle size={14} className="text-[#ef4444]" />
                  <span className="text-xs text-[#e4e8f1]">
                    最高风险:
                    <span className="text-[#58a6ff] font-medium ml-1">#{batchResult.overview.highest_risk_pr.pr_number}</span>
                    <span className="text-[#ef4444] font-bold ml-1">{batchResult.overview.highest_risk_pr.risk_score}分</span>
                  </span>
                </div>
              )}
            </div>

            <div className="mb-5">
              <p className="text-xs text-[#7b829c] mb-3 font-medium">
                风险项分布 · 共 {Object.values(batchResult.overview.risk_distribution).reduce((a: number, b: number) => a + (b || 0), 0)} 项
              </p>
              <div className="flex h-8 rounded-lg overflow-hidden">
                {[
                  { level: "critical", label: "严重", color: "#ef4444" },
                  { level: "high", label: "高风险", color: "#f59e0b" },
                  { level: "medium", label: "中风险", color: "#3b82f6" },
                  { level: "low", label: "低风险", color: "#06d6a0" },
                ].map(({ level, label, color }) => {
                  const count = batchResult.overview.risk_distribution[level] || 0
                  const pct = batchResult.overview.total_prs > 0
                    ? (count / batchResult.overview.total_prs) * 100
                    : 0
                  if (count === 0) return null
                  return (
                    <div
                      key={level}
                      className="flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                        minWidth: count > 0 ? "48px" : "0",
                      }}
                    >
                      {count > 0 && `${label} ${count}`}
                    </div>
                  )
                })}
              </div>
              {batchResult.overview.total_prs > 0 && (
                <div className="flex gap-3 mt-2">
                  {[
                    { level: "critical", label: "严重", color: "#ef4444" },
                    { level: "high", label: "高风险", color: "#f59e0b" },
                    { level: "medium", label: "中风险", color: "#3b82f6" },
                    { level: "low", label: "低风险", color: "#06d6a0" },
                  ].map(({ level, label, color }) => {
                    const count = batchResult.overview.risk_distribution[level] || 0
                    return (
                      <span key={level} className="flex items-center gap-1 text-[10px] text-[#7b829c]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        {label} {count}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {batchResult.overview.top_risks.length > 0 && (
              <div className="p-4 bg-[#0a0e1a] border border-[#f59e0b]/20 rounded-lg">
                <p className="text-xs font-semibold text-[#f59e0b] mb-2 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  跨 PR 共同高风险项
                </p>
                <div className="space-y-1.5">
                  {batchResult.overview.top_risks.map((risk, i) => (
                    <p key={i} className="text-sm text-[#e4e8f1] flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b] text-[10px] flex items-center justify-center font-bold mt-0.5">
                        {i + 1}
                      </span>
                      {risk}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {batchResult.duplicate_analysis && (
            <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-6 shadow-lg shadow-black/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#06d6a0]/10 flex items-center justify-center">
                  <ListChecks size={20} className="text-[#06d6a0]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#e4e8f1]">跨 PR 重复检测</h3>
                  <p className="text-xs text-[#7b829c]">{batchResult.duplicate_analysis.summary}</p>
                </div>
              </div>

              {batchResult.duplicate_analysis.file_overlaps.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#06d6a0] mb-2">文件重叠</p>
                  <div className="space-y-2">
                    {batchResult.duplicate_analysis.file_overlaps.map((fo, i) => (
                      <div key={i} className="p-3 bg-[#0a0e1a] border border-[#1e2440] rounded-lg">
                        <p className="text-sm font-mono text-[#e4e8f1]">{fo.filename}</p>
                        <p className="text-xs text-[#7b829c] mt-1">
                          涉及 PR: {fo.pr_numbers.map((n) => `#${n}`).join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {batchResult.duplicate_analysis.duplicate_risk_patterns.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#f59e0b] mb-2">重复风险模式</p>
                  <div className="space-y-2">
                    {batchResult.duplicate_analysis.duplicate_risk_patterns.map((dp, i) => (
                      <div key={i} className="p-3 bg-[#0a0e1a] border border-[#1e2440] rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor: `${RISK_SEVERITY_CONFIG[dp.severity as keyof typeof RISK_SEVERITY_CONFIG]?.color || "#7b829c"}20`,
                              color: RISK_SEVERITY_CONFIG[dp.severity as keyof typeof RISK_SEVERITY_CONFIG]?.color || "#7b829c",
                            }}
                          >
                            {RISK_SEVERITY_CONFIG[dp.severity as keyof typeof RISK_SEVERITY_CONFIG]?.label || dp.severity}
                          </span>
                          <span className="text-xs text-[#7b829c]">
                            出现 {dp.occurrence_count} 次 · 影响 {dp.affected_prs.length} 个 PR
                          </span>
                        </div>
                        <p className="text-sm text-[#e4e8f1]">{dp.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {detailPR ? (
              <div>
                <button
                  onClick={() => setDetailPR(null)}
                  className="flex items-center gap-1.5 text-sm text-[#58a6ff] hover:text-[#7cb8ff] transition-colors mb-4"
                >
                  <ChevronUp size={16} className="rotate-90" />
                  返回批量概览
                </button>
                <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-6 space-y-5 shadow-lg shadow-black/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-[#58a6ff]">
                        <a href={`https://github.com/${detailPR.pr_info.owner}/${detailPR.pr_info.repo}/pull/${detailPR.pr_info.number}`}
                           target="_blank" rel="noopener noreferrer"
                           className="hover:underline flex items-center gap-1.5 group">
                          #{detailPR.pr_info.number} {detailPR.pr_info.title}
                          <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#7b829c] mt-1">
                        <span className="flex items-center gap-1"><GitBranch size={12} />{detailPR.pr_info.head_branch} → {detailPR.pr_info.base_branch}</span>
                        <span>{detailPR.pr_info.author}</span>
                        <span className="text-[#06d6a0]">+{detailPR.pr_info.additions}</span>
                        <span className="text-[#ef4444]">-{detailPR.pr_info.deletions}</span>
                        <span className="flex items-center gap-1"><Clock size={12} />{detailPR.estimated_review_minutes} 分钟</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 text-xl font-bold ${
                        RISK_LEVEL_CONFIG[detailPR.risk_level].bgClass
                      } ${RISK_LEVEL_CONFIG[detailPR.risk_level].textClass}`}>
                        {detailPR.risk_score}
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-md font-medium ${
                        RISK_LEVEL_CONFIG[detailPR.risk_level].bgClass
                      } ${RISK_LEVEL_CONFIG[detailPR.risk_level].textClass}`}>
                        {RISK_LEVEL_CONFIG[detailPR.risk_level].label}
                      </span>
                    </div>
                  </div>

                  {detailPR.summary && (
                    <div className="p-4 bg-[#0a0e1a] border border-[#1e2440] rounded-lg">
                      <p className="text-xs font-semibold text-[#7b829c] mb-1">PR 摘要</p>
                      <p className="text-sm text-[#e4e8f1] leading-relaxed whitespace-pre-line">{detailPR.summary}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-semibold text-[#ef4444] mb-3">
                      风险项 ({detailPR.risk_items.length})
                    </p>
                    <RiskList risks={detailPR.risk_items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])}
                      feedback={feedback}
                      analysisId={detailPR.analysis_id}
                      onFeedbackChange={() => setFeedback({ ...feedback })} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#3b82f6] mb-3">
                      改进建议 ({detailPR.suggestions.length})
                    </p>
                    <SuggestionList suggestions={detailPR.suggestions}
                      feedback={feedback}
                      analysisId={detailPR.analysis_id}
                      onFeedbackChange={() => setFeedback({ ...feedback })} />
                  </div>

                  {detailPR.analysis_id && (
                    <ReviewChat
                      analysisId={detailPR.analysis_id}
                      repoOwner={detailPR.pr_info.owner}
                      repoName={detailPR.pr_info.repo}
                      prTitle={detailPR.pr_info.title}
                      summary={detailPR.summary}
                      riskItems={detailPR.risk_items}
                      suggestions={detailPR.suggestions}
                    />
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#e4e8f1]">各 PR 分析结果</h3>
                  <button
                    onClick={() => {
                      if (expandedPRs.size === batchResult.results.length) {
                        setExpandedPRs(new Set())
                      } else {
                        setExpandedPRs(new Set(batchResult.results.map((r) => r.pr_info.number)))
                      }
                    }}
                    className="text-xs text-[#7b829c] hover:text-[#e4e8f1] transition-colors ml-auto"
                  >
                    {expandedPRs.size === batchResult.results.length ? "全部收起" : "全部展开"}
                  </button>
                </div>

                {batchResult.results.map((prResult) => {
                  const prLevelConfig = RISK_LEVEL_CONFIG[prResult.risk_level]
                  const isExpanded = expandedPRs.has(prResult.pr_info.number)
                  return (
                    <div
                      key={prResult.pr_info.number}
                      className="bg-[#131829] border border-[#1e2440] rounded-xl overflow-hidden transition-all duration-300 hover:border-[#06d6a0]/20"
                    >
                      <button
                        onClick={() => toggleExpand(prResult.pr_info.number)}
                        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#0a0e1a]/50 transition-all"
                      >
                        <span className="text-sm font-bold text-[#58a6ff]">#{prResult.pr_info.number}</span>
                        <span className="text-sm text-[#e4e8f1] truncate flex-1">{prResult.pr_info.title}</span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-[#7b829c]">{prResult.pr_info.files_changed} 文件</span>
                          <span className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${prLevelConfig.bgClass} ${prLevelConfig.textClass}`}>
                            {prResult.risk_score}
                          </span>
                          {isExpanded ? <ChevronUp size={16} className="text-[#7b829c]" /> : <ChevronDown size={16} className="text-[#7b829c]" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[#1e2440] p-5 space-y-4">
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#7b829c]">
                            <span className="flex items-center gap-1">
                              <GitBranch size={12} />
                              {prResult.pr_info.head_branch} → {prResult.pr_info.base_branch}
                            </span>
                            <span>{prResult.pr_info.author}</span>
                            <span className="text-[#06d6a0]">+{prResult.pr_info.additions}</span>
                            <span className="text-[#ef4444]">-{prResult.pr_info.deletions}</span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {prResult.estimated_review_minutes} 分钟
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDetailPR(prResult) }}
                              className="ml-auto flex items-center gap-1 text-xs text-[#06d6a0] hover:text-[#05c090] transition-colors px-2 py-1 rounded-md bg-[#06d6a0]/5 hover:bg-[#06d6a0]/10 border border-[#06d6a0]/15"
                            >
                              <Target size={11} />
                              查看完整详情
                            </button>
                          </div>

                          {prResult.summary && (
                            <div className="p-3 bg-[#0a0e1a] border border-[#1e2440] rounded-lg">
                              <p className="text-sm text-[#e4e8f1] leading-relaxed">{prResult.summary}</p>
                            </div>
                          )}
                          {prResult.intent_check && (
                            <IntentCheckCard data={prResult.intent_check} />
                          )}
                          {prResult.risk_items.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-[#ef4444]">风险项 ({prResult.risk_items.length})</p>
                                {prResult.risk_items.length > 5 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDetailPR(prResult) }}
                                    className="text-[10px] text-[#06d6a0] hover:text-[#05c090] transition-colors"
                                  >
                                    查看全部 →
                                  </button>
                                )}
                              </div>
                              <RiskListCompact risks={prResult.risk_items} limit={5} />
                            </div>
                          )}

                          {prResult.suggestions.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-[#3b82f6]">改进建议 ({prResult.suggestions.length})</p>
                                {prResult.suggestions.length > 3 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDetailPR(prResult) }}
                                    className="text-[10px] text-[#06d6a0] hover:text-[#05c090] transition-colors"
                                  >
                                    查看全部 →
                                  </button>
                                )}
                              </div>
                              <SuggestionListCompact suggestions={prResult.suggestions} limit={3} />
                            </div>
                          )}

                          {prResult.analysis_id && (
                            <ReviewChat
                              analysisId={prResult.analysis_id}
                              repoOwner={prResult.pr_info.owner}
                              repoName={prResult.pr_info.repo}
                              prTitle={prResult.pr_info.title}
                              summary={prResult.summary}
                              riskItems={prResult.risk_items}
                              suggestions={prResult.suggestions}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-[#1e2440]">
            <PRReview />
          </div>
        </>
      )}

      {hasResult && (
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#7b829c] bg-[#131829] border border-[#1e2440] rounded-lg hover:text-[#e4e8f1] hover:border-[#2d3560] transition-all"
        >
          <RotateCcw size={14} />
          分析新的 PR
        </button>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out both; }
      `}</style>
    </div>
  )
}

function RiskListCompact({ risks, limit = 5 }: { risks: RiskItem[]; limit?: number }) {
  const displayed = risks.slice(0, limit)
  return (
    <div className="space-y-1.5">
      {displayed.map((risk, i) => {
        const sevConfig = RISK_SEVERITY_CONFIG[risk.severity]
        return (
          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#0a0e1a] border border-[#1e2440]">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5"
              style={{ backgroundColor: `${sevConfig.color}20`, color: sevConfig.color }}
            >
              {sevConfig.label}
            </span>
            <div>
              <p className="text-xs text-[#e4e8f1]">{risk.description}</p>
              <p className="text-[10px] text-[#7b829c] font-mono mt-0.5">{risk.file}:{risk.line}</p>
            </div>
          </div>
        )
      })}
      {risks.length > limit && (
        <p className="text-xs text-[#7b829c] text-center">...还有 {risks.length - limit} 个风险项</p>
      )}
    </div>
  )
}

function SuggestionListCompact({ suggestions, limit = 3 }: { suggestions: SuggestionItem[]; limit?: number }) {
  const displayed = suggestions.slice(0, limit)
  return (
    <div className="space-y-1.5">
      {displayed.map((s, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[#0a0e1a] border border-[#1e2440]">
          <Zap size={12} className="text-[#3b82f6] flex-shrink-0" />
          <p className="text-xs text-[#e4e8f1]">{s.description}</p>
        </div>
      ))}
      {suggestions.length > limit && (
        <p className="text-xs text-[#7b829c] text-center">...还有 {suggestions.length - limit} 个改进建议</p>
      )}
    </div>
  )
}

function RuleMatchesView({ matches }: { matches: RuleMatch[] }) {
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#7b829c]">
        <div className="w-12 h-12 rounded-full bg-[#7c3aed]/10 flex items-center justify-center mb-3">
          <Check size={24} className="text-[#7c3aed]" />
        </div>
        <p className="text-sm font-medium">无自定义规则命中</p>
        <p className="text-xs mt-1 opacity-60">可在系统设置中添加自定义规则</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {matches.map((m, i) => (
        <div key={i} className="p-4 rounded-xl border border-[#7c3aed]/20 bg-[#0a0e1a]">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-[#7c3aed]">{m.rule_name}</span>
            <span className="text-[10px] text-[#7b829c] font-mono">{m.file}:{m.line}</span>
          </div>
          <p className="text-xs text-[#7b829c] font-mono bg-[#0a0e1a] p-3 rounded-lg border border-[#1e2440] overflow-x-auto whitespace-pre-wrap">
            {m.matched_text}
          </p>
          {m.suggestion && (
            <p className="mt-2 text-xs text-[#06d6a0] flex items-center gap-1">
              <Lightbulb size={11} />
              {m.suggestion}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
