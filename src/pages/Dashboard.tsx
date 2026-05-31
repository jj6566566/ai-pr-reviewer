import { useState, useEffect } from "react"
import {
  GitPullRequest,
  Bug,
  Timer,
  TrendingUp,
} from "lucide-react"
import type { HistoryItem, TrendResponse, TrendSummary } from "@/types/review"
import { fetchHistory, fetchTrends } from "@/api/review"
import StatCard from "@/components/StatCard"
import PRListTable from "@/components/PRListTable"
import ReviewSummary from "@/components/ReviewSummary"
import TeamTrendChart from "@/components/TeamTrendChart"
import RepoHealthCards from "@/components/RepoHealthCards"

export default function Dashboard() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [trendSummary, setTrendSummary] = useState<TrendSummary | null>(null)
  const [trendDataPoints, setTrendDataPoints] = useState<TrendResponse["data_points"]>([])
  const [trendsLoading, setTrendsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalReviewed: 0,
    criticalCount: 0,
    avgScore: 0,
  })
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    setLoading(true)
    setTrendsLoading(true)

    fetchHistory(500)
      .then((items) => {
        setHistory(items)
        const critical = items.filter((h) => h.risk_level === "critical").length
        const totalScore = items.reduce(
          (sum, h) => sum + (h.risk_score || 0),
          0
        )
        setStats({
          totalReviewed: items.length,
          criticalCount: critical,
          avgScore: items.length > 0 ? Math.round(totalScore / items.length) : 0,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    fetchTrends(30)
      .then((data) => {
        setTrendDataPoints(data.data_points)
        setTrendSummary(data.summary)
      })
      .catch(() => {})
      .finally(() => setTrendsLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRefresh = async () => {
    loadData()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#e4e8f1]">仪表盘</h2>
        <p className="text-sm text-[#7b829c] mt-1">ReviewAI - AI 驱动的代码评审概览</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={GitPullRequest}
          label="历史评审 PR"
          value={loading ? "..." : stats.totalReviewed}
          color="teal"
          delay={50}
        />
        <StatCard
          icon={Bug}
          label="严重风险 PR"
          value={loading ? "..." : stats.criticalCount}
          color="purple"
          delay={100}
        />
        <StatCard
          icon={Timer}
          label="平均风险分"
          value={loading ? "..." : `${stats.avgScore}/100`}
          color="amber"
          delay={150}
        />
        <StatCard
          icon={TrendingUp}
          label={trendSummary ? `${trendSummary.total_prs} PRs` : "趋势统计"}
          value={trendSummary ? `${trendSummary.trend_direction === "improving" ? "改善" : trendSummary.trend_direction === "worsening" ? "恶化" : "稳定"}` : "..."}
          color="blue"
          delay={200}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PRListTable history={history} loading={loading} />
        </div>
        <div>
          <ReviewSummary history={history} loading={loading} />
        </div>
      </div>

      <TeamTrendChart
        dataPoints={trendDataPoints}
        summary={trendSummary}
        loading={trendsLoading}
        onRefresh={handleRefresh}
      />

      <RepoHealthCards loading={loading} />
    </div>
  )
}
