import { useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  GitBranch,
  FileCode,
  Plus,
  Minus,
  Clock,
  AlertTriangle,
  Shield,
  Zap,
  Lightbulb,
  Bug,
  Check,
  X,
  MessageCircle,
} from "lucide-react"
import { aiSuggestions } from "@/data/mock"

interface PR {
  id: number
  title: string
  repo: string
  author: { name: string; avatarUrl: string }
  aiScore: number
  status: "pending" | "in_review" | "completed"
  issuesCount: { critical: number; major: number; suggestion: number; optimization: number }
  createdAt: string
  updatedAt: string
  branch: string
  targetBranch: string
  filesChanged: number
  additions: number
  deletions: number
}

interface PRCardProps {
  pr: PR
}

const statusColors: Record<string, string> = {
  pending: "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30",
  in_review: "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30",
  completed: "bg-[#06d6a0]/10 text-[#06d6a0] border-[#06d6a0]/30",
}

const statusLabels: Record<string, string> = {
  pending: "待评审",
  in_review: "评审中",
  completed: "已完成",
}

const severityIcons: Record<string, typeof AlertTriangle> = {
  critical: Bug,
  major: AlertTriangle,
  suggestion: Lightbulb,
  optimization: Zap,
}

const severityColors: Record<string, string> = {
  critical: "#ef4444",
  major: "#f59e0b",
  suggestion: "#3b82f6",
  optimization: "#06d6a0",
}

const categoryIcons: Record<string, typeof Shield> = {
  security: Shield,
  performance: Zap,
  style: Lightbulb,
  logic: Bug,
  best_practice: Lightbulb,
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return "刚刚"
  if (diffHours < 24) return `${diffHours} 小时前`
  return `${Math.floor(diffHours / 24)} 天前`
}

export default function PRCard({ pr }: PRCardProps) {
  const [expanded, setExpanded] = useState(false)
  const suggestions = aiSuggestions.filter((s) => s.prId === pr.id)

  return (
    <div className="bg-[#131829] border border-[#1e2440] rounded-xl overflow-hidden transition-all duration-300 hover:border-[#06d6a0]/20">
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0">
          <img
            src={pr.author.avatarUrl}
            alt={pr.author.name}
            className="w-9 h-9 rounded-full border border-[#1e2440]"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-[#e4e8f1] truncate">
              {pr.title}
            </h4>
            <span
              className={`flex-shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full border ${statusColors[pr.status]}`}
            >
              {statusLabels[pr.status]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-[#7b829c]">
            <span>{pr.repo}</span>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {timeAgo(pr.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <GitBranch size={11} />
              {pr.branch}
            </span>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#7b829c]">
            <span className="flex items-center gap-1">
              <FileCode size={12} />
              {pr.filesChanged}
            </span>
            <span className="flex items-center gap-1 text-[#06d6a0]">
              <Plus size={12} />+{pr.additions}
            </span>
            <span className="flex items-center gap-1 text-[#ef4444]">
              <Minus size={12} />-{pr.deletions}
            </span>
          </div>

          {pr.issuesCount.critical > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#ef4444]/10 text-[#ef4444] text-xs font-semibold animate-pulse-glow">
              <Bug size={12} />
              {pr.issuesCount.critical}
            </span>
          )}

          <div className="flex items-center gap-2 ml-2">
            <span className="text-sm font-bold text-[#e4e8f1] w-6 text-right">
              {pr.aiScore}
            </span>
            {expanded ? (
              <ChevronUp size={16} className="text-[#7b829c]" />
            ) : (
              <ChevronDown size={16} className="text-[#7b829c]" />
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#1e2440] bg-[#0a0e1a]">
          <div className="flex">
            <div className="flex-1 border-r border-[#1e2440] p-5">
              <h5 className="text-xs font-semibold text-[#7b829c] uppercase tracking-wider mb-3">
                代码差异预览
              </h5>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex">
                  <span className="w-10 text-right pr-3 text-[#484f58] select-none">142</span>
                  <span className="text-[#e4e8f1]">
                    <span className="text-[#ef4444]">-</span>{" "}
                    await db.payments.update({"{"} id: paymentId, status:
                    &apos;completed&apos; {"}"})
                  </span>
                </div>
                <div className="flex">
                  <span className="w-10 text-right pr-3 text-[#484f58] select-none"></span>
                  <span className="text-[#e4e8f1]">
                    <span className="text-[#06d6a0]">+</span>{" "}
                    await db.transaction(async (trx) =&gt; {"{"}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-10 text-right pr-3 text-[#484f58] select-none"></span>
                  <span className="text-[#e4e8f1]">
                    <span className="text-[#06d6a0]">+</span>{"  "}
                    const payment = await trx.payments
                  </span>
                </div>
                <div className="flex">
                  <span className="w-10 text-right pr-3 text-[#484f58] select-none"></span>
                  <span className="text-[#e4e8f1]">
                    <span className="text-[#06d6a0]">+</span>{"    "}
                    .select(&apos;status&apos;).where({"{"} id: paymentId {"}"})
                  </span>
                </div>
                <div className="flex">
                  <span className="w-10 text-right pr-3 text-[#484f58] select-none"></span>
                  <span className="text-[#e4e8f1]">
                    <span className="text-[#06d6a0]">+</span>{"    "}
                    .forUpdate().first()
                  </span>
                </div>
                <div className="flex">
                  <span className="w-10 text-right pr-3 text-[#484f58] select-none"></span>
                  <span className="text-[#e4e8f1]">
                    <span className="text-[#06d6a0]">+</span>{" "}
                    {"}"})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 p-5">
              <h5 className="text-xs font-semibold text-[#7b829c] uppercase tracking-wider mb-3">
                AI 评审建议 ({suggestions.length})
              </h5>

              {suggestions.length === 0 ? (
                <p className="text-sm text-[#7b829c] py-4 text-center">
                  暂无 AI 评审建议
                </p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {suggestions.map((s) => {
                    const SevIcon = severityIcons[s.severity]
                    const CatIcon = categoryIcons[s.category]
                    const sevColor = severityColors[s.severity]

                    return (
                      <div
                        key={s.id}
                        className={`rounded-lg p-3 border ${
                          s.status === "accepted"
                            ? "border-[#06d6a0]/20 bg-[#06d6a0]/5"
                            : s.status === "ignored"
                            ? "border-[#484f58]/20 bg-[#0f1324] opacity-60"
                            : "border-[#1e2440] bg-[#0f1324]"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <SevIcon size={14} style={{ color: sevColor }} className="flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-[#e4e8f1]">
                                {s.title}
                              </p>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                style={{
                                  backgroundColor: `${sevColor}15`,
                                  color: sevColor,
                                }}
                              >
                                {s.severity}
                              </span>
                              <CatIcon size={11} className="text-[#7b829c]" />
                            </div>
                            <p className="text-[11px] text-[#7b829c] mt-1">
                              {s.file}:{s.line}
                            </p>

                            <div className="mt-2 space-y-2">
                              <div className="bg-[#0a0e1a] rounded-md p-2 border border-[#1e2440]">
                                <p className="text-[10px] text-[#ef4444] mb-1 font-medium">当前代码</p>
                                <pre className="text-[11px] text-[#e4e8f1] font-mono whitespace-pre-wrap">
                                  {s.currentCode}
                                </pre>
                              </div>
                              <div className="bg-[#0a0e1a] rounded-md p-2 border border-[#06d6a0]/20">
                                <p className="text-[10px] text-[#06d6a0] mb-1 font-medium">AI 建议</p>
                                <pre className="text-[11px] text-[#e4e8f1] font-mono whitespace-pre-wrap">
                                  {s.suggestionCode}
                                </pre>
                              </div>
                            </div>

                            {s.status === "pending" && (
                              <div className="flex items-center gap-2 mt-3">
                                <button className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-[#06d6a0]/10 text-[#06d6a0] border border-[#06d6a0]/30 rounded-lg hover:bg-[#06d6a0]/20 transition-colors">
                                  <Check size={12} />
                                  采纳
                                </button>
                                <button className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-[#484f58]/10 text-[#7b829c] border border-[#1e2440] rounded-lg hover:bg-[#1e2440] transition-colors">
                                  <X size={12} />
                                  忽略
                                </button>
                                <button className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 rounded-lg hover:bg-[#3b82f6]/20 transition-colors">
                                  <MessageCircle size={12} />
                                  讨论
                                </button>
                              </div>
                            )}

                            {s.status === "accepted" && (
                              <p className="text-[11px] text-[#06d6a0] mt-2 flex items-center gap-1">
                                <Check size={12} /> 已采纳
                              </p>
                            )}
                            {s.status === "ignored" && (
                              <p className="text-[11px] text-[#7b829c] mt-2 flex items-center gap-1">
                                <X size={12} /> 已忽略
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
