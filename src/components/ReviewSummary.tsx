import type { HistoryItem } from "@/types/review"

interface ReviewSummaryProps {
  history: HistoryItem[]
  loading: boolean
}

export default function ReviewSummary({ history, loading }: ReviewSummaryProps) {
  const critical = history.filter((h) => h.risk_level === "critical").length
  const high = history.filter((h) => h.risk_level === "high").length
  const medium = history.filter((h) => h.risk_level === "medium").length
  const low = history.filter((h) => h.risk_level === "low").length
  const total = history.length

  const segments = [
    { label: "致命", count: critical, color: "#ef4444" },
    { label: "高危", count: high, color: "#f59e0b" },
    { label: "中等", count: medium, color: "#3b82f6" },
    { label: "低风险", count: low, color: "#06d6a0" },
  ]

  const circumference = 2 * Math.PI * 56
  let currentOffset = 0
  const dashSegments = total > 0
    ? segments.map((seg) => {
        const percent = seg.count / total
        const length = percent * circumference
        const offset = -currentOffset
        currentOffset += length
        return { ...seg, length, offset }
      })
    : segments.map((seg) => ({ ...seg, length: 0, offset: 0 }))

  return (
    <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-5 animate-fade-in-up stagger-4" style={{ opacity: 0 }}>
      <h3 className="text-base font-semibold text-[#e4e8f1] mb-4">AI 评审摘要</h3>

      {loading ? (
        <div className="flex items-center gap-6">
          <div className="w-[136px] h-[136px] rounded-full bg-[#1e2440] animate-pulse" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 bg-[#1e2440] rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : total === 0 ? (
        <div className="py-8 text-center text-sm text-[#7b829c]">
          暂无评审数据
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <div className="relative w-[136px] h-[136px] flex-shrink-0">
            <svg width="136" height="136" viewBox="0 0 136 136">
              <circle cx="68" cy="68" r="56" fill="none" stroke="#1e2440" strokeWidth="12" />
              {dashSegments.map((seg, i) => (
                <circle
                  key={i}
                  cx="68" cy="68" r="56"
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="12"
                  strokeLinecap="butt"
                  strokeDasharray={`${seg.length} ${circumference - seg.length}`}
                  strokeDashoffset={seg.offset}
                  transform="rotate(-90 68 68)"
                  className="transition-all duration-700"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[#e4e8f1]">{total}</span>
              <span className="text-[11px] text-[#7b829c]">总评审数</span>
            </div>
          </div>

          <div className="flex-1 space-y-2.5">
            {segments.map((seg) => (
              <div key={seg.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                  <span className="text-xs text-[#7b829c]">{seg.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-[#1e2440] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${total > 0 ? (seg.count / total) * 100 : 0}%`, backgroundColor: seg.color }}
                    />
                  </div>
                  <span className="text-xs font-mono font-medium text-[#e4e8f1] w-5 text-right">
                    {seg.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
