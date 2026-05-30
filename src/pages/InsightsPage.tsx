import { useState, useEffect } from "react"
import { BarChart3, Zap, TrendingUp, Shield, FileCode, AlertTriangle, Lightbulb } from "lucide-react"
import SideNav from "@/components/SideNav"
import TopNavbar from "@/components/TopNavbar"
import StatCard from "@/components/StatCard"
import { RISK_SEVERITY_CONFIG, type RiskLevel } from "@/types/review"

interface DirectoryHeatmapItem {
  directory: string
  risk_count: number
  critical_count: number
  high_count: number
  avg_severity: string
}

interface TopIssueItem {
  description: string
  count: number
  severity: string
  category: string
}

interface CrossPRPatternItem {
  description: string
  severity: string
  pr_count: number
}

interface InsightsData {
  directory_heatmap: DirectoryHeatmapItem[]
  top_issues: TopIssueItem[]
  cross_pr_patterns: CrossPRPatternItem[]
  suggested_rules: string[]
  total_analyses: number
}

const API_BASE = import.meta.env.VITE_API_BASE || ""

const categoryColors: Record<string, string> = {
  "安全": "#ef4444",
  "性能": "#f59e0b",
  "健壮性": "#3b82f6",
  "可维护性": "#7c3aed",
  "其他": "#7b829c",
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/api/review/insights`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("pr_review_token")}` },
    })
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0a0e1a]">
        <SideNav />
        <div className="flex-1 flex flex-col">
          <TopNavbar />
          <div className="flex-1 flex items-center justify-center">
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full border-4 border-[#06d6a0] border-t-transparent animate-spin mx-auto" />
              <p className="text-sm text-[#7b829c]">正在分析历史数据...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen bg-[#0a0e1a]">
        <SideNav />
        <div className="flex-1 flex flex-col">
          <TopNavbar />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[#7b829c]">
              <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无分析数据，先分析几个 PR 再来看看吧</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalRisks = data.directory_heatmap.reduce((s, d) => s + d.risk_count, 0)
  const maxRiskCount = Math.max(1, ...data.directory_heatmap.map((d) => d.risk_count))

  return (
    <div className="flex min-h-screen bg-[#0a0e1a]">
      <SideNav />
      <div className="flex-1 flex flex-col overflow-auto">
        <TopNavbar />
        <div className="p-6 space-y-6">

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#e4e8f1]">代码洞察</h2>
              <p className="text-sm text-[#7b829c] mt-1">基于 {data.total_analyses} 次历史分析的数据洞察</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={BarChart3} label="总分析次数" value={data.total_analyses} color="teal" delay={0} />
            <StatCard icon={Zap} label="总风险项" value={totalRisks} color="amber" delay={100} />
            <StatCard icon={TrendingUp} label="高频问题" value={data.top_issues.length} color="purple" delay={200} />
            <StatCard icon={Shield} label="安全风险目录" value={data.directory_heatmap.filter((d) => d.critical_count > 0).length} color="red" delay={300} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#e4e8f1] mb-4 flex items-center gap-2">
                <FileCode size={16} className="text-[#06d6a0]" />
                目录风险热力图
              </h3>
              {data.directory_heatmap.length === 0 ? (
                <p className="text-sm text-[#7b829c] text-center py-8">暂无数据</p>
              ) : (
                <div className="space-y-2">
                  {data.directory_heatmap.map((d) => {
                    const sevCfg = RISK_SEVERITY_CONFIG[d.avg_severity as RiskLevel] || RISK_SEVERITY_CONFIG.low
                    return (
                      <div key={d.directory} className="group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[#b8c4d8] truncate max-w-[70%]" title={d.directory}>
                            {d.directory}
                          </span>
                          <span className="text-xs text-[#7b829c]">
                            {d.risk_count} 个风险
                            {d.critical_count > 0 && <span className="text-[#ef4444] ml-1">· {d.critical_count} 严重</span>}
                          </span>
                        </div>
                        <div className="h-3 bg-[#0a0e1a] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(d.risk_count / maxRiskCount) * 100}%`,
                              backgroundColor: sevCfg.color,
                              opacity: 0.3 + (d.risk_count / maxRiskCount) * 0.7,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#e4e8f1] mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-[#f59e0b]" />
                高频问题 Top {Math.min(10, data.top_issues.length)}
              </h3>
              {data.top_issues.length === 0 ? (
                <p className="text-sm text-[#7b829c] text-center py-8">暂无数据</p>
              ) : (
                <div className="space-y-2">
                  {data.top_issues.slice(0, 10).map((issue, i) => {
                    const sevCfg = RISK_SEVERITY_CONFIG[issue.severity as RiskLevel] || RISK_SEVERITY_CONFIG.low
                    const catColor = categoryColors[issue.category] || "#7b829c"
                    return (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-[#1e2440] last:border-0">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-bold" style={{ backgroundColor: `${sevCfg.color}15`, color: sevCfg.color }}>
                          {i + 1}
                        </span>
                        <p className="flex-1 text-xs text-[#e4e8f1] truncate" title={issue.description}>
                          {issue.description}
                        </p>
                        <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: `${catColor}15`, color: catColor }}>
                          {issue.category}
                        </span>
                        <span className="flex-shrink-0 text-xs text-[#7b829c]">{issue.count} 次</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#e4e8f1] mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-[#7c3aed]" />
                跨 PR 重复风险模式
              </h3>
              {data.cross_pr_patterns.length === 0 ? (
                <p className="text-sm text-[#7b829c] text-center py-8">暂未发现跨 PR 重复模式</p>
              ) : (
                <div className="space-y-3">
                  {data.cross_pr_patterns.map((pattern, i) => {
                    const sevCfg = RISK_SEVERITY_CONFIG[pattern.severity as RiskLevel] || RISK_SEVERITY_CONFIG.low
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 bg-[#0a0e1a] rounded-lg border border-[#1e2440]">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${sevCfg.color}15`, color: sevCfg.color }}>
                          {pattern.pr_count}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#e4e8f1]" title={pattern.description}>{pattern.description}</p>
                          <p className="text-[10px] text-[#7b829c] mt-1">
                            出现在 <span className="text-[#e4e8f1] font-medium">{pattern.pr_count}</span> 个不同 PR 中
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="bg-[#131829] border border-[#1e2440] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#e4e8f1] mb-4 flex items-center gap-2">
                <Lightbulb size={16} className="text-[#f59e0b]" />
                编码规范建议
              </h3>
              {data.suggested_rules.length === 0 ? (
                <p className="text-sm text-[#7b829c] text-center py-8">暂无建议</p>
              ) : (
                <div className="space-y-2">
                  {data.suggested_rules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-[#0a0e1a] rounded-lg border border-[#1e2440] transition-all hover:border-[#7c3aed]/30">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#7c3aed]/10 text-[#7c3aed] text-[10px] flex items-center justify-center font-bold">
                        {i + 1}
                      </div>
                      <p className="text-xs text-[#e4e8f1]">{rule}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
