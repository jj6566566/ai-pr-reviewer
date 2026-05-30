import { useNavigate } from "react-router-dom"
import { Clock, ArrowRight } from "lucide-react"

import type { HistoryItem } from "@/types/review"
import { RISK_LEVEL_CONFIG } from "@/types/review"

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

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return "刚刚"
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} 天前`
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 18
  const offset = circumference - (score / 100) * circumference
  const color =
    score >= 80 ? "#06d6a0" : score >= 60 ? "#f59e0b" : "#ef4444"

  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="none" stroke="#1e2440" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 20 20)"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#e4e8f1]">
        {score}
      </span>
    </div>
  )
}

interface PRListTableProps {
  history: HistoryItem[]
  loading: boolean
}

export default function PRListTable({ history, loading }: PRListTableProps) {
  const navigate = useNavigate()
  const recentPRs = history.slice(0, 5)

  return (
    <div className="bg-[#131829] border border-[#1e2440] rounded-xl overflow-hidden animate-fade-in-up stagger-3" style={{ opacity: 0 }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2440]">
        <h3 className="text-base font-semibold text-[#e4e8f1]">近期 PR 评审</h3>
        <button
          onClick={() => navigate("/review")}
          className="flex items-center gap-1 text-xs font-medium text-[#06d6a0] hover:text-[#06d6a0]/80 transition-colors"
        >
          查看全部 <ArrowRight size={14} />
        </button>
      </div>

      {loading ? (
        <div className="divide-y divide-[#1e2440]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="w-10 h-10 rounded-full bg-[#1e2440] animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#1e2440] rounded animate-pulse w-3/4" />
                <div className="h-3 bg-[#1e2440] rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : recentPRs.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#7b829c]">
          暂无评审记录，去「PR 分析」页面开始评审
        </div>
      ) : (
        <div className="divide-y divide-[#1e2440]">
          {recentPRs.map((pr) => {
            const levelConfig = RISK_LEVEL_CONFIG[pr.risk_level]
            return (
              <div
                key={pr.id}
                onClick={() => navigate(`/analyze?id=${pr.id}`)}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#0f1324] transition-colors cursor-pointer"
              >
                <ScoreRing score={pr.risk_score} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#e4e8f1] truncate">
                      {pr.pr_title || `${pr.repo_owner}/${pr.repo_name} #${pr.pr_number}`}
                    </p>
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full border ${statusColors[pr.status] || "text-[#7b829c] border-[#1e2440]"}`}
                    >
                      {statusLabels[pr.status] || pr.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#7b829c]">
                    <span>{pr.repo_owner}/{pr.repo_name}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {timeAgo(pr.created_at)}
                    </span>
                    <span
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${levelConfig.bgClass} ${levelConfig.textClass}`}
                    >
                      {levelConfig.label}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
