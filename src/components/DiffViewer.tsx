import { useState, useMemo, useRef, useEffect } from "react"
import { AlertTriangle, Bug, Lightbulb, ChevronDown, ChevronRight, GitBranch, Info } from "lucide-react"
import type { RiskItem } from "@/types/review"
import { RISK_SEVERITY_CONFIG } from "@/types/review"

interface DiffLine {
  type: "context" | "add" | "del" | "header" | "hunk"
  oldLine?: number
  newLine?: number
  content: string
  risks: RiskItem[]
}

interface FileSection {
  filename: string
  lines: DiffLine[]
  riskCount: number
  addedCount: number
  deletedCount: number
}

const severityIcons: Record<string, React.ReactNode> = {
  critical: <Bug size={11} />,
  high: <AlertTriangle size={11} />,
  medium: <Lightbulb size={11} />,
  low: <Lightbulb size={11} />,
}

function parseDiff(diffContent: string, riskItems: RiskItem[]): FileSection[] {
  const sections: FileSection[] = []
  const lines = diffContent.split("\n")

  let currentFile = ""
  let currentLines: DiffLine[] = []
  let oldLine = 0
  let newLine = 0

  const headerRegex = /^--- a\/(.*)$/
  const newFileRegex = /^\+\+\+ b\/(.*)$/
  const hunkRegex = /^@@ -(\d+),?\d* \+(\d+),?\d* @@/

  const riskLookup = new Map<string, RiskItem[]>()
  for (const r of riskItems) {
    const key = `${r.file}:${r.line}`
    const list = riskLookup.get(key) || []
    list.push(r)
    riskLookup.set(key, list)
  }

  function getRisks(file: string, line: number): RiskItem[] {
    return riskLookup.get(`${file}:${line}`) || []
  }

  function finishFile() {
    if (currentFile && currentLines.length > 0) {
      const riskCount = currentLines.reduce((sum, l) => sum + l.risks.length, 0)
      const addedCount = currentLines.filter((l) => l.type === "add").length
      const deletedCount = currentLines.filter((l) => l.type === "del").length
      sections.push({ filename: currentFile, lines: [...currentLines], riskCount, addedCount, deletedCount })
    }
    currentFile = ""
    currentLines = []
    oldLine = 0
    newLine = 0
  }

  for (const line of lines) {
    const headerMatch = line.match(headerRegex)
    if (headerMatch) {
      finishFile()
      currentFile = headerMatch[1]
      currentLines.push({ type: "header", content: line, risks: [] })
      continue
    }

    const newFileMatch = line.match(newFileRegex)
    if (newFileMatch) {
      if (currentFile) {
        currentLines.push({ type: "header", content: line, risks: [] })
      } else {
        currentFile = newFileMatch[1]
        currentLines.push({ type: "header", content: `--- a/${currentFile}`, risks: [] })
        currentLines.push({ type: "header", content: line, risks: [] })
      }
      continue
    }

    const hunkMatch = line.match(hunkRegex)
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10)
      newLine = parseInt(hunkMatch[2], 10)
      currentLines.push({ type: "hunk", content: line, risks: [] })
      continue
    }

    if (!currentFile) continue

    if (line.startsWith("-")) {
      const old = oldLine++
      currentLines.push({ type: "del", oldLine: old, content: line.substring(1), risks: getRisks(currentFile, old) })
    } else if (line.startsWith("+")) {
      const n = newLine++
      currentLines.push({ type: "add", newLine: n, content: line.substring(1), risks: getRisks(currentFile, n) })
    } else {
      oldLine++
      newLine++
      currentLines.push({
        type: "context",
        oldLine: oldLine - 1,
        newLine: newLine - 1,
        content: line.startsWith(" ") ? line.substring(1) : line,
        risks: getRisks(currentFile, newLine - 1),
      })
    }
  }

  finishFile()
  return sections
}

export default function DiffViewer({
  diffContent,
  riskItems,
  highlightedRiskIdx,
  onRiskClick,
}: {
  diffContent: string
  riskItems: RiskItem[]
  highlightedRiskIdx?: number | null
  onRiskClick?: (idx: number) => void
}) {
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())
  const scrollRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const sections = useMemo(() => parseDiff(diffContent, riskItems), [diffContent, riskItems])
  const totalRisks = sections.reduce((s, f) => s + f.riskCount, 0)

  useEffect(() => {
    if (highlightedRiskIdx != null && riskItems[highlightedRiskIdx]) {
      const r = riskItems[highlightedRiskIdx]
      const key = `${r.file}:${r.line}`
      const el = scrollRefs.current.get(key)
      if (el) {
        setCollapsedFiles((prev) => {
          const next = new Set(prev)
          next.delete(r.file)
          return next
        })
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 50)
      }
    }
  }, [highlightedRiskIdx, riskItems])

  function toggleFile(filename: string) {
    setCollapsedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }

  if (!diffContent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#7b829c]">
        <Info size={24} className="mb-2 opacity-30" />
        <p className="text-sm">暂无 diff 数据</p>
        <p className="text-xs mt-1 opacity-50">可能因为历史记录未保存代码变更</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-[#0d1222] border border-[#1e2440] rounded-lg text-[10px] text-[#7b829c]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-[#06d6a0]/20 border border-[#06d6a0]/30" />
          新增行
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-[#ef4444]/20 border border-[#ef4444]/30" />
          删除行
        </span>
        {totalRisks > 0 && (
          <>
            <span className="text-[#4a5178]">|</span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-[#f59e0b]/20 border border-[#f59e0b]/30" />
              风险行 ({totalRisks} 处)
            </span>
          </>
        )}
        <span className="ml-auto text-[#4a5178]">
          {sections.length} 个文件 · {sections.reduce((s, f) => s + f.lines.filter((l) => l.type !== "header" && l.type !== "hunk").length, 0)} 行
        </span>
      </div>

      <div className="rounded-lg overflow-hidden border border-[#1e2440]">
        {sections.map((file, fi) => {
          const isCollapsed = collapsedFiles.has(file.filename)

          return (
            <div key={fi} className="border-b border-[#1e2440] last:border-b-0">
              <button
                onClick={() => toggleFile(file.filename)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#0d1222] hover:bg-[#141b2e] transition-colors text-left"
              >
                {isCollapsed ? (
                  <ChevronRight size={14} className="text-[#4a5178] flex-shrink-0" />
                ) : (
                  <ChevronDown size={14} className="text-[#4a5178] flex-shrink-0" />
                )}
                <GitBranch size={12} className="text-[#58a6ff] flex-shrink-0" />
                <span className="text-xs font-mono text-[#58a6ff] truncate">{file.filename}</span>
                <span className="text-[10px] text-[#06d6a0]/70">+{file.addedCount}</span>
                <span className="text-[10px] text-[#ef4444]/70">-{file.deletedCount}</span>
                {file.riskCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f59e0b]/15 text-[#f59e0b] font-medium ml-auto">
                    {file.riskCount} 风险
                  </span>
                )}
              </button>

              {!isCollapsed && (
                <div className="overflow-x-auto font-mono text-xs leading-5">
                  <table className="w-full border-collapse">
                    <tbody>
                      {file.lines.map((line, li) => {
                        if (line.type === "header") {
                          return (
                            <tr key={li}>
                              <td colSpan={3} className="pl-4 py-0.5 text-[#5a6788] bg-[#0a0e1a]/70 select-none">
                                {line.content}
                              </td>
                            </tr>
                          )
                        }
                        if (line.type === "hunk") {
                          return (
                            <tr key={li}>
                              <td colSpan={3} className="px-4 py-0.5 text-[#3b82f6]/70 bg-[#181f34] text-[10px] select-none">
                                {line.content}
                              </td>
                            </tr>
                          )
                        }

                        const isRisk = line.risks.length > 0
                        const maxSev = line.risks.reduce((w, r) => {
                          const o: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 }
                          return o[r.severity] > o[w] ? r.severity : w
                        }, "low" as string)

                        const lineBg =
                          line.type === "del"
                            ? isRisk ? "bg-[#ef4444]/12" : "bg-[#ef4444]/5"
                            : line.type === "add"
                              ? isRisk ? "bg-[#06d6a0]/12" : "bg-[#06d6a0]/5"
                              : isRisk
                                ? "bg-[#f59e0b]/8"
                                : ""

                        const marker = line.type === "del" ? "-" : line.type === "add" ? "+" : " "
                        const markerColor =
                          line.type === "del"
                            ? "text-[#ef4444]"
                            : line.type === "add"
                              ? "text-[#06d6a0]"
                              : "text-[#4a5178]"

                        const borderClass = isRisk
                          ? maxSev === "critical"
                            ? "border-l-[3px] border-l-[#ef4444]"
                            : maxSev === "high"
                              ? "border-l-[3px] border-l-[#f59e0b]"
                              : "border-l-[3px] border-l-[#3b82f6]"
                          : ""

                        const refKey = line.type !== "del"
                          ? `${file.filename}:${line.newLine}`
                          : ""

                        return (
                          <tr key={li} className={`${lineBg} ${borderClass} transition-colors`}>
                            <td className="w-[50px] text-right select-none px-2 py-0.5 border-r border-[#1e2440]/60 text-[#4a5178] text-[11px] bg-[#0d1222]/50">
                              {line.oldLine != null ? line.oldLine : ""}
                            </td>
                            <td className="w-[50px] text-right select-none px-2 py-0.5 border-r border-[#1e2440]/60 text-[#4a5178] text-[11px] bg-[#0d1222]/50">
                              {line.newLine != null ? line.newLine : ""}
                            </td>
                            <td className="px-2 py-0.5">
                              <div ref={refKey ? (el) => { if (el && !scrollRefs.current.has(refKey)) scrollRefs.current.set(refKey, el) } : undefined} className="flex items-start min-h-[20px]">
                                <span className={`select-none flex-shrink-0 w-4 ${markerColor}`}>{marker}</span>
                                <span className={line.type === "del" ? "text-[#e8a0a0]" : line.type === "add" ? "text-[#a0e8d0]" : "text-[#c4d0e0]"}>
                                  {line.content}
                                </span>
                                {isRisk &&
                                  line.risks.map((r, ri) => {
                                    const cfg = RISK_SEVERITY_CONFIG[r.severity]
                                    const gIdx = riskItems.indexOf(r)
                                    return (
                                      <button
                                        key={ri}
                                        onClick={() => onRiskClick?.(gIdx)}
                                        className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:brightness-125 transition-all flex-shrink-0"
                                        style={{
                                          backgroundColor: cfg.color + "22",
                                          color: cfg.color,
                                          border: `1px solid ${cfg.color}50`,
                                        }}
                                        title={`${cfg.label}: ${r.description}`}
                                      >
                                        {severityIcons[r.severity]}
                                        {cfg.label}
                                      </button>
                                    )
                                  })}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {totalRisks === 0 && riskItems.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 text-[10px] text-[#7b829c] bg-[#0d1222] border border-[#1e2440] rounded-lg">
          <Info size={12} className="flex-shrink-0" />
          AI 未返回具体文件行号，风险项无法在 diff 上标注。请查看「风险项」标签页了解详情。
        </div>
      )}
    </div>
  )
}
