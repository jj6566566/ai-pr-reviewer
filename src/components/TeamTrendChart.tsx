import { useState, useMemo } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import type { TrendDataPoint, TrendSummary } from "@/types/review"

interface TeamTrendChartProps {
  dataPoints: TrendDataPoint[]
  summary: TrendSummary | null
  loading?: boolean
  onRefresh?: () => Promise<void>
}

function formatDayLabel(day: string | null): string {
  if (!day) return ""
  const datePart = day.split("T")[0]
  const parts = datePart.split("-")
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`
  }
  return datePart.length > 5 ? datePart.slice(5) : datePart
}

function smoothCurve(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ""
  
  let path = `M ${points[0].x} ${points[0].y}`
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    
    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  
  return path
}

function LineChart({ 
  dataPoints, 
  dataKey, 
  title, 
  color, 
  unit = "" 
}: { 
  dataPoints: { day: string | null; pr_count: number; avg_risk_score: number }[]
  dataKey: "pr_count" | "avg_risk_score"
  title: string
  color: string
  unit?: string
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const chartData = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return null

    const values = dataPoints.map(d => d[dataKey])
    const maxVal = Math.max(...values, 1)
    const minVal = Math.min(...values, 0)
    const range = maxVal - minVal

    const chartW = 280
    const chartH = 120
    const padding = { top: 8, right: 35, bottom: 30, left: 35 }
    const plotW = chartW - padding.left - padding.right
    const plotH = chartH - padding.top - padding.bottom

    const stepX = dataPoints.length > 1 ? plotW / (dataPoints.length - 1) : plotW / 2

    const points = dataPoints.map((d, i) => {
      const normalizedVal = (d[dataKey] - minVal) / (range || 1)
      return {
        x: padding.left + i * stepX,
        y: padding.top + plotH - normalizedVal * plotH,
        val: d[dataKey],
      }
    })

    const path = smoothCurve(points)

    const yTicks = [0, 0.33, 0.66, 1].map(ratio => ({
      y: padding.top + plotH - ratio * plotH,
      val: Math.round(minVal + ratio * range),
    }))

    return { chartW, chartH, padding, plotH, points, path, yTicks, maxVal }
  }, [dataPoints, dataKey])

  if (!chartData) return null

  const { chartW, chartH, padding, plotH, points, path, yTicks } = chartData

  return (
    <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-[#e4e8f1]">{title}</h4>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        </div>
      </div>

      <svg
        width="100%"
        height={chartH}
        viewBox={`0 0 ${chartW} ${chartH}`}
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        {yTicks.map((tick, i) => (
          <line
            key={`h-${i}`}
            x1={padding.left}
            y1={tick.y}
            x2={chartW - padding.right}
            y2={tick.y}
            stroke="#1e2440"
            strokeWidth="0.5"
          />
        ))}

        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + plotH}
          stroke="#1e2440"
          strokeWidth="0.5"
        />

        <defs>
          <linearGradient id={`lineGrad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {path && (
          <>
            <path
              d={`${path} L${points[points.length - 1].x},${padding.top + plotH} L${points[0].x},${padding.top + plotH} Z`}
              fill={`url(#lineGrad-${dataKey})`}
            />
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {points.map((p, i) => (
          <circle
            key={`p-${i}`}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#0a0e1a"
            stroke={color}
            strokeWidth="2"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          />
        ))}

        {yTicks.map((tick, i) => (
          <text
            key={`y-${i}`}
            x={padding.left - 6}
            y={tick.y + 3}
            textAnchor="end"
            className="fill-[#7b829c]"
            style={{ fontSize: "9px" }}
          >
            {tick.val}{unit}
          </text>
        ))}

        {dataPoints.filter((_, i) => i % 3 === 0).map((d, idx) => {
          const actualIdx = idx * 3
          return (
            <text
              key={`x-${actualIdx}`}
              x={points[actualIdx].x}
              y={padding.top + plotH + 16}
              textAnchor="middle"
              className="fill-[#7b829c]"
              style={{ fontSize: "9px" }}
            >
              {formatDayLabel(d.day)}
            </text>
          )
        })}
      </svg>

      {hoveredIdx !== null && hoveredIdx < dataPoints.length && (
        <div
          className="absolute pointer-events-none bg-[#0f1324] border border-[#1e2440] rounded-lg px-2 py-1.5 text-xs shadow-xl z-10"
          style={{
            left: `${Math.min(Math.max(points[hoveredIdx].x - 40, 0), chartW - 100)}px`,
            top: `${points[hoveredIdx].y - 35}px`,
          }}
        >
          <p className="text-[#e4e8f1] font-medium">{formatDayLabel(dataPoints[hoveredIdx].day)}</p>
          <p style={{ color }}>{points[hoveredIdx].val}{unit}</p>
        </div>
      )}
    </div>
  )
}

function BarChart({ 
  dataPoints, 
  dataKey, 
  title, 
  color, 
  unit = "" 
}: { 
  dataPoints: { day: string | null; pr_count: number; avg_risk_score: number }[]
  dataKey: "pr_count" | "avg_risk_score"
  title: string
  color: string
  unit?: string
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const chartData = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return null

    const values = dataPoints.map(d => d[dataKey])
    const maxVal = Math.max(...values, 1)

    const chartW = 280
    const chartH = 120
    const padding = { top: 8, right: 35, bottom: 30, left: 35 }
    const plotW = chartW - padding.left - padding.right
    const plotH = chartH - padding.top - padding.bottom

    const barWidth = Math.min(12, plotW / dataPoints.length * 0.6)
    const stepX = plotW / dataPoints.length

    const bars = dataPoints.map((d, i) => ({
      x: padding.left + i * stepX + (stepX - barWidth) / 2,
      width: barWidth,
      height: (d[dataKey] / maxVal) * plotH,
      y: padding.top + plotH - (d[dataKey] / maxVal) * plotH,
      val: d[dataKey],
    }))

    const yTicks = [0, 0.33, 0.66, 1].map(ratio => ({
      y: padding.top + plotH - ratio * plotH,
      val: Math.round(maxVal * ratio),
    }))

    return { chartW, chartH, padding, plotH, bars, yTicks, maxVal, stepX }
  }, [dataPoints, dataKey])

  if (!chartData) return null

  const { chartW, chartH, padding, plotH, bars, yTicks, stepX } = chartData

  return (
    <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-[#e4e8f1]">{title}</h4>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        </div>
      </div>

      <svg
        width="100%"
        height={chartH}
        viewBox={`0 0 ${chartW} ${chartH}`}
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        {yTicks.map((tick, i) => (
          <line
            key={`h-${i}`}
            x1={padding.left}
            y1={tick.y}
            x2={chartW - padding.right}
            y2={tick.y}
            stroke="#1e2440"
            strokeWidth="0.5"
          />
        ))}

        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + plotH}
          stroke="#1e2440"
          strokeWidth="0.5"
        />

        <defs>
          <linearGradient id={`barGrad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.8" />
            <stop offset="100%" stopColor={color} stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {bars.map((bar, i) => (
          <rect
            key={`bar-${i}`}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            rx={bar.width / 2}
            fill={`url(#barGrad-${dataKey})`}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          />
        ))}

        {yTicks.map((tick, i) => (
          <text
            key={`y-${i}`}
            x={padding.left - 6}
            y={tick.y + 3}
            textAnchor="end"
            className="fill-[#7b829c]"
            style={{ fontSize: "9px" }}
          >
            {tick.val}{unit}
          </text>
        ))}

        {dataPoints.filter((_, i) => i % 3 === 0).map((d, idx) => {
          const actualIdx = idx * 3
          return (
            <text
              key={`x-${actualIdx}`}
              x={padding.left + actualIdx * stepX + stepX / 2}
              y={padding.top + plotH + 16}
              textAnchor="middle"
              className="fill-[#7b829c]"
              style={{ fontSize: "9px" }}
            >
              {formatDayLabel(d.day)}
            </text>
          )
        })}
      </svg>

      {hoveredIdx !== null && hoveredIdx < dataPoints.length && (
        <div
          className="absolute pointer-events-none bg-[#0f1324] border border-[#1e2440] rounded-lg px-2 py-1.5 text-xs shadow-xl z-10"
          style={{
            left: `${Math.min(Math.max(bars[hoveredIdx].x + bars[hoveredIdx].width / 2 - 40, 0), chartW - 100)}px`,
            top: `${bars[hoveredIdx].y - 35}px`,
          }}
        >
          <p className="text-[#e4e8f1] font-medium">{formatDayLabel(dataPoints[hoveredIdx].day)}</p>
          <p style={{ color }}>{bars[hoveredIdx].val}{unit}</p>
        </div>
      )}
    </div>
  )
}

export default function TeamTrendChart({ dataPoints, summary, loading = false, onRefresh }: TeamTrendChartProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true)
      onRefresh().finally(() => setIsRefreshing(false))
    }
  }

  if (loading) {
    return (
      <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-[#e4e8f1]">团队效率趋势</h3>
        </div>
        <div className="py-12 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-[#7b829c]" />
        </div>
      </div>
    )
  }

  if (!dataPoints || dataPoints.length === 0) {
    return (
      <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-[#e4e8f1]">团队效率趋势</h3>
        </div>
        <div className="py-8 text-center text-sm text-[#7b829c]">
          暂无趋势数据，开始分析 PR 后将自动生成
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-[#e4e8f1]">团队效率趋势</h3>
          {summary && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all duration-300 ${
              summary.trend_direction === "improving"
                ? "bg-[#06d6a0]/10 text-[#06d6a0] border border-[#06d6a0]/30"
                : summary.trend_direction === "worsening"
                ? "bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30"
                : "bg-[#7b829c]/10 text-[#7b829c] border border-[#7b829c]/30"
            }`}>
              {summary.trend_direction === "improving" ? "↑ 改善中" : summary.trend_direction === "worsening" ? "↓ 恶化中" : "→ 稳定"}
            </span>
          )}
        </div>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg hover:bg-[#1e2440] transition-colors disabled:opacity-50"
            title="刷新数据"
          >
            <RefreshCw size={14} className={`text-[#7b829c] ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LineChart
          dataPoints={dataPoints}
          dataKey="pr_count"
          title="PR 分析数"
          color="#3b82f6"
        />
        <BarChart
          dataPoints={dataPoints}
          dataKey="avg_risk_score"
          title="平均风险分"
          color="#06d6a0"
          unit="/100"
        />
      </div>
    </div>
  )
}
