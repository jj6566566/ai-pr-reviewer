import { useState, useEffect, useRef, useCallback } from "react"
import { Bell, ExternalLink, GitPullRequest, Check, Clock } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { fetchNotifications } from "@/api/github"
import type { Notification } from "@/types/auth"
import { useAuth } from "@/contexts/AuthContext"

function getSeenKey(login: string): string {
  return `pr_review_seen_${login}`
}

function getSeenPRs(login: string): Set<string> {
  try {
    const raw = localStorage.getItem(getSeenKey(login))
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

function saveSeenPRs(login: string, seen: Set<string>) {
  localStorage.setItem(getSeenKey(login), JSON.stringify([...seen]))
}

function prKey(n: Notification): string {
  return `${n.repo_full_name}#${n.pr_number}`
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString("zh-CN")
}

export default function NotificationBell() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const login = user?.login || ""

  const seenPRs = getSeenPRs(login)
  const unseenCount = notifications.filter((n) => !seenPRs.has(prKey(n))).length

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    try {
      const data = await fetchNotifications()
      setNotifications(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications()
      const interval = setInterval(loadNotifications, 120000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, loadNotifications])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const markAsSeen = (n: Notification) => {
    const key = prKey(n)
    const seen = getSeenPRs(login)
    if (seen.has(key)) return
    seen.add(key)
    saveSeenPRs(login, seen)
  }

  const markAllAsSeen = () => {
    const seen = getSeenPRs(login)
    notifications.forEach((n) => seen.add(prKey(n)))
    saveSeenPRs(login, seen)
    setOpen(false)
  }

  const handleClickPR = (n: Notification) => {
    markAsSeen(n)
  }

  const handleGoAnalyze = (n: Notification) => {
    markAsSeen(n)
    navigate(`/analyze?owner=${encodeURIComponent(n.repo_owner)}&repo=${encodeURIComponent(n.repo_name)}&pr=${n.pr_number}`)
  }

  const handleToggle = () => {
    setOpen((prev) => !prev)
  }

  if (!isAuthenticated) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-lg text-[#7b829c] hover:text-[#e4e8f1] hover:bg-[#1e2440] transition-all"
        title="PR 通知"
      >
        <Bell size={20} />
        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#ef4444] text-white text-[10px] font-bold px-1 leading-none animate-pulse">
            {unseenCount > 99 ? "99+" : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[400px] max-h-[520px] bg-[#131829] border border-[#1e2440] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2440]">
            <h3 className="text-sm font-semibold text-[#e4e8f1] flex items-center gap-2">
              <Bell size={15} className="text-[#06d6a0]" />
              PR 通知
              {unseenCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#ef4444]/15 text-[#ef4444]">
                  {unseenCount} 条新
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={loadNotifications}
                disabled={loading}
                className="text-xs text-[#7b829c] hover:text-[#e4e8f1] transition-colors disabled:opacity-50"
              >
                {loading ? "刷新中..." : "刷新"}
              </button>
              {unseenCount > 0 && (
                <button
                  onClick={markAllAsSeen}
                  className="flex items-center gap-1 text-xs text-[#06d6a0] hover:text-[#05c090] transition-colors"
                >
                  <Check size={13} />
                  全部已读
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto max-h-[440px]">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-[#06d6a0]/30 border-t-[#06d6a0] rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#7b829c]">
                <Bell size={32} className="mb-3 opacity-30" />
                <p className="text-sm">暂无新 PR 通知</p>
                <p className="text-xs mt-1 opacity-60">近 7 天没有新的 Pull Request</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isNew = !seenPRs.has(prKey(n))
                return (
                  <div
                    key={prKey(n)}
                    onClick={() => handleClickPR(n)}
                    className={`cursor-pointer px-5 pt-3 pb-2 text-left hover:bg-[#1e2440]/50 transition-all border-b border-[#1e2440]/50 ${
                      isNew ? "bg-[#06d6a0]/3" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {n.author_avatar ? (
                          <img
                            src={n.author_avatar}
                            alt={n.author}
                            className="w-8 h-8 rounded-full border border-[#1e2440]"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#1e2440] flex items-center justify-center">
                            <GitPullRequest size={14} className="text-[#7b829c]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2440] text-[#58a6ff] font-mono truncate max-w-[140px]">
                            {n.repo_full_name}
                          </span>
                          <span className="text-[11px] text-[#58a6ff] font-semibold">
                            #{n.pr_number}
                          </span>
                          {isNew && (
                            <span className="w-2 h-2 rounded-full bg-[#ef4444] flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-[#e4e8f1] truncate leading-snug">{n.title}</p>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-[#7b829c]">
                          <span>{n.author}</span>
                          <span>·</span>
                          <Clock size={10} />
                          <span>{timeAgo(n.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGoAnalyze(n)
                        }}
                        className="text-xs px-3 py-1 rounded-md bg-[#06d6a0]/10 text-[#06d6a0] hover:bg-[#06d6a0]/20 border border-[#06d6a0]/20 hover:border-[#06d6a0]/40 transition-all flex items-center gap-1"
                      >
                        去分析
                        <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
