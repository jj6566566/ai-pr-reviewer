import { useState, useEffect, useRef } from "react"
import { GitBranch, Clock, Check } from "lucide-react"
import type { PullRequest as PR } from "@/types/auth"
import { fetchRepoPulls } from "@/api/github"

interface PRListProps {
  owner: string
  repo: string
  onSelectPR: (owner: string, repo: string, number: number) => void
  multiSelect?: boolean
  selectedPRs?: number[]
  onSelectionChange?: (selected: number[]) => void
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

export default function PRList({ owner, repo, onSelectPR, multiSelect = false, selectedPRs = [], onSelectionChange }: PRListProps) {
  const [prs, setPrs] = useState<PR[]>([])
  const [loading, setLoading] = useState(false)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    setPrs([])
    if (!owner || !repo) return

    setLoading(true)
    fetchRepoPulls(owner, repo)
      .then((data) => {
        if (!cancelled.current) {
          const sorted = [...data].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          setPrs(sorted)
        }
      })
      .catch(() => {
        if (!cancelled.current) setPrs([])
      })
      .finally(() => {
        if (!cancelled.current) setLoading(false)
      })

    return () => {
      cancelled.current = true
    }
  }, [owner, repo])

  const togglePR = (prNumber: number) => {
    if (!onSelectionChange) return
    if (selectedPRs.includes(prNumber)) {
      onSelectionChange(selectedPRs.filter((n) => n !== prNumber))
    } else {
      onSelectionChange([...selectedPRs, prNumber])
    }
  }

  if (!owner || !repo) {
    return (
      <div className="py-8 text-center text-sm text-[#7b829c]">
        请先选择一个仓库
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-[#131829] rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (prs.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[#7b829c]">
        <GitBranch size={32} className="mx-auto mb-2 opacity-30" />
        该仓库暂无 Pull Request
      </div>
    )
  }

  return (
    <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
      {prs.map((pr) => {
        const isSelected = selectedPRs.includes(pr.number)
        return (
          <button
            key={pr.number}
            onClick={() => {
              if (multiSelect) {
                togglePR(pr.number)
              } else {
                onSelectPR(owner, repo, pr.number)
              }
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left border ${
              isSelected
                ? "bg-[#06d6a0]/5 border-[#06d6a0]/30"
                : "border-transparent hover:bg-[#131829] hover:border-[#06d6a0]/20"
            }`}
          >
            {multiSelect && (
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected
                    ? "bg-[#06d6a0] border-[#06d6a0]"
                    : "border-[#2d3560] group-hover:border-[#06d6a0]/50"
                }`}
              >
                {isSelected && <Check size={12} className="text-[#0a0e1a]" />}
              </div>
            )}
            <img
              src={pr.user.avatar_url}
              alt={pr.user.login}
              className="w-7 h-7 rounded-full flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#e4e8f1] truncate">
                <span className="text-[#7b829c]">#{pr.number}</span>{" "}
                {pr.title}
              </p>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-[#7b829c]">
                <span className="flex items-center gap-1">
                  <GitBranch size={10} />
                  {pr.user.login}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {timeAgo(pr.created_at)}
                </span>
              </div>
            </div>
            <span
              className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full ${
                pr.state === "open"
                  ? "bg-[#06d6a0]/10 text-[#06d6a0]"
                  : "bg-[#7c3aed]/10 text-[#7c3aed]"
              }`}
            >
              {pr.state === "open" ? "Open" : "Closed"}
            </span>
          </button>
        )
      })}
    </div>
  )
}
