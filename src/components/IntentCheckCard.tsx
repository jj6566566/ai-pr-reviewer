import { Target, AlertTriangle, CheckCircle2, MinusCircle, FileText, ArrowRight } from "lucide-react"

const typeLabels: Record<string, string> = {
  scope_drift: "范围漂移",
  hidden_breaking: "隐含破坏性改动",
  missing_desc: "描述遗漏",
  unrelated_file: "无关文件变更",
}

const typeIcons: Record<string, React.ReactNode> = {
  scope_drift: <ArrowRight size={12} />,
  hidden_breaking: <AlertTriangle size={12} />,
  missing_desc: <FileText size={12} />,
  unrelated_file: <MinusCircle size={12} />,
}

export interface IntentCheckData {
  declared_intent: string
  actual_scope: string
  consistency_score: number
  verdict: "match" | "minor_deviation" | "major_deviation"
  discrepancies: {
    type: string
    description: string
    file: string
    severity: string
  }[]
}

export default function IntentCheckCard({ data }: { data: IntentCheckData }) {
  const isMatch = data.verdict === "match"
  const isMinor = data.verdict === "minor_deviation"
  const isMajor = data.verdict === "major_deviation"

  const scoreColor = isMatch ? "#06d6a0" : isMinor ? "#f59e0b" : "#ef4444"
  const scoreBg = isMatch ? "bg-[#06d6a0]/10" : isMinor ? "bg-[#f59e0b]/10" : "bg-[#ef4444]/10"
  const scoreBorder = isMatch ? "border-[#06d6a0]/30" : isMinor ? "border-[#f59e0b]/30" : "border-[#ef4444]/30"

  return (
    <div className={`rounded-xl border ${scoreBorder} ${scoreBg}/30 p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-[#e4e8f1] flex items-center gap-2">
          <Target size={16} className={isMatch ? "text-[#06d6a0]" : isMinor ? "text-[#f59e0b]" : "text-[#ef4444]"} />
          PR 意图一致性检查
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#7b829c]">一致性评分</span>
          <span className="text-lg font-bold" style={{ color: scoreColor }}>{data.consistency_score}</span>
          <span className="text-[10px] text-[#7b829c]">/ 100</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[#131829] border border-[#1e2440] rounded-lg p-3">
          <p className="text-[10px] font-semibold text-[#7b829c] uppercase tracking-wider mb-1 flex items-center gap-1">
            <FileText size={11} />
            声明的意图
          </p>
          <p className="text-xs text-[#c4d0e0] leading-relaxed">{data.declared_intent || "未描述意图"}</p>
        </div>
        <div className="bg-[#131829] border border-[#1e2440] rounded-lg p-3">
          <p className="text-[10px] font-semibold text-[#7b829c] uppercase tracking-wider mb-1 flex items-center gap-1">
            <ArrowRight size={11} />
            实际变更范围
          </p>
          <p className="text-xs text-[#c4d0e0] leading-relaxed">{data.actual_scope || "无法判定"}</p>
        </div>
      </div>

      {isMatch && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#06d6a0]/5 border border-[#06d6a0]/20 rounded-lg text-xs text-[#06d6a0]">
          <CheckCircle2 size={14} />
          代码变更与声明意图一致，未发现偏离
        </div>
      )}

      {!isMatch && data.discrepancies.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[#f59e0b] uppercase tracking-wider">
            发现 {data.discrepancies.length} 处不一致
          </p>
          {data.discrepancies.map((d, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
                d.severity === "high"
                  ? "bg-[#ef4444]/5 border border-[#ef4444]/20 text-[#ef4444]"
                  : d.severity === "medium"
                    ? "bg-[#f59e0b]/5 border border-[#f59e0b]/20 text-[#f59e0b]"
                    : "bg-[#1e2440]/50 border border-[#1e2440] text-[#a0b0d0]"
              }`}
            >
              <span className="mt-0.5 flex-shrink-0">{typeIcons[d.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="leading-relaxed">{d.description}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-70">
                  <span className="px-1 rounded bg-black/20">{typeLabels[d.type] || d.type}</span>
                  {d.file && <span className="font-mono">{d.file}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
