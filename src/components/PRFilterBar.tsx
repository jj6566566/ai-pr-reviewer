import { Search, Filter } from "lucide-react"

interface PRFilterBarProps {
  searchQuery: string
  onSearchChange: (v: string) => void
  statusFilter: string
  onStatusChange: (v: string) => void
  severityFilter: string
  onSeverityChange: (v: string) => void
}

const statusOptions = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待评审" },
  { value: "in_review", label: "评审中" },
  { value: "completed", label: "已完成" },
]

const severityOptions = [
  { value: "all", label: "全部等级" },
  { value: "critical", label: "致命" },
  { value: "major", label: "严重" },
  { value: "suggestion", label: "建议" },
]

export default function PRFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  severityFilter,
  onSeverityChange,
}: PRFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="relative flex-1 min-w-[200px] max-w-[360px]">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5178] pointer-events-none"
        />
        <input
          type="text"
          placeholder="搜索 PR 标题或仓库..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-9 pl-9 pr-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] placeholder-[#4a5178] focus:outline-none focus:border-[#06d6a0] transition-colors"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <Filter size={14} className="text-[#4a5178]" />
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              statusFilter === opt.value
                ? "bg-[#06d6a0]/10 border-[#06d6a0]/40 text-[#06d6a0]"
                : "bg-[#0f1324] border-[#1e2440] text-[#7b829c] hover:text-[#e4e8f1] hover:border-[#2d3560]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={severityFilter}
          onChange={(e) => onSeverityChange(e.target.value)}
          className="h-9 px-3 text-xs bg-[#0f1324] border border-[#1e2440] rounded-lg text-[#e4e8f1] focus:outline-none focus:border-[#06d6a0] cursor-pointer"
        >
          {severityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
