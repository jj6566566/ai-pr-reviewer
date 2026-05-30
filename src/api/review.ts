import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AnalyzeResult,
  HistoryItem,
  HistoryDetail,
  CustomRule,
  BatchAnalyzeItem,
  BatchAnalyzeResponse,
  TrendResponse,
  FeedbackItem,
} from "@/types/review"

const API_BASE = "/api"

export async function analyzePR(params: AnalyzeRequest): Promise<AnalyzeResult> {
  const { owner, repo, prNumber } = params
  const response = await fetch(`${API_BASE}/review/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner: owner.trim(), repo: repo.trim(), pr_number: prNumber }),
  })

  if (!response.ok) {
    let errorMsg = `请求失败 (HTTP ${response.status})`
    try {
      const errorBody = await response.json()
      if (typeof errorBody?.detail === "string") errorMsg = errorBody.detail
      else if (typeof errorBody?.error === "string") errorMsg = errorBody.error
    } catch {}
    return { success: false, error: errorMsg }
  }

  const data: AnalyzeResponse = await response.json()
  return { success: true, data }
}

export function analyzePRStream(
  params: AnalyzeRequest,
  onProgress: (data: { stage: string; files_changed: number; additions: number; deletions: number }) => void,
  onToken: (token: string) => void,
  onComplete: (data: AnalyzeResponse) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): () => void {
  const controller = new AbortController()
  const combinedSignal = signal
    ? (() => {
        signal.addEventListener("abort", () => controller.abort())
        return controller.signal
      })()
    : controller.signal

  const { owner, repo, prNumber } = params

  fetch(`${API_BASE}/review/analyze-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner: owner.trim(), repo: repo.trim(), pr_number: prNumber }),
    signal: combinedSignal,
  }).then(async (response) => {
    try {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          const eventStart = trimmed.indexOf("event: ")
          const dataStart = trimmed.indexOf("data: ")
          if (eventStart === -1 || dataStart === -1) continue

          const eventEnd = trimmed.indexOf("\n", eventStart)
          const eventName = trimmed.slice(eventStart + 7, eventEnd === -1 ? trimmed.length : eventEnd)
          const dataStr = trimmed.slice(dataStart + 6)

          try {
            const parsed = JSON.parse(dataStr)
            if (eventName === "progress") {
              onProgress(parsed)
            } else if (eventName === "token") {
              onToken(parsed)
            } else if (eventName === "complete") {
              onComplete(parsed)
            } else if (eventName === "error") {
              onError(parsed.error || "未知错误")
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return
      onError(err instanceof Error ? err.message : "流式分析中断")
    }
  }).catch((err) => {
    if (err instanceof DOMException && err.name === "AbortError") return
    onError(err instanceof Error ? err.message : "网络请求失败")
  })

  return () => controller.abort()
}

export async function fetchHistory(limit = 20): Promise<HistoryItem[]> {
  const response = await fetch(`${API_BASE}/review/history?limit=${limit}`)
  if (!response.ok) throw new Error("获取历史记录失败")
  return response.json()
}

export async function fetchHistoryDetail(id: number): Promise<HistoryDetail> {
  const response = await fetch(`${API_BASE}/review/history/${id}`)
  if (!response.ok) throw new Error("获取历史记录详情失败")
  return response.json()
}

export async function analyzeBatch(prs: BatchAnalyzeItem[]): Promise<BatchAnalyzeResponse> {
  const response = await fetch(`${API_BASE}/review/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prs }),
  })
  if (!response.ok) throw new Error("批量分析失败")
  return response.json()
}

export type BatchStreamHandlers = {
  onProgress: (data: { current: number; total: number; pr_number: number; stage: string }) => void
  onToken: (data: { pr_number: number; pr_index: number; token: string }) => void
  onPRComplete: (data: { current: number; total: number; pr_number: number; result: AnalyzeResponse }) => void
  onComplete: (data: BatchAnalyzeResponse) => void
  onError: (data: { pr_number?: number; error: string }) => void
}

export function analyzeBatchStream(
  prs: BatchAnalyzeItem[],
  handlers: BatchStreamHandlers,
  signal?: AbortSignal
): () => void {
  const controller = new AbortController()
  const combinedSignal = signal
    ? (() => { signal.addEventListener("abort", () => controller.abort()); return controller.signal })()
    : controller.signal

  fetch(`${API_BASE}/review/batch-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prs }),
    signal: combinedSignal,
  }).then(async (response) => {
    try {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          const eventStart = trimmed.indexOf("event: ")
          const dataStart = trimmed.indexOf("data: ")
          if (eventStart === -1 || dataStart === -1) continue

          const eventEnd = trimmed.indexOf("\n", eventStart)
          const eventName = trimmed.slice(eventStart + 7, eventEnd === -1 ? trimmed.length : eventEnd)
          const dataStr = trimmed.slice(dataStart + 6)

          try {
            const parsed = JSON.parse(dataStr)
            switch (eventName) {
              case "batch_progress":
                handlers.onProgress(parsed)
                break
              case "batch_token":
                handlers.onToken(parsed)
                break
              case "batch_pr_complete":
                handlers.onPRComplete(parsed)
                break
              case "batch_complete":
                handlers.onComplete(parsed)
                break
              case "batch_error":
                handlers.onError(parsed)
                break
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return
      handlers.onError({ error: err instanceof Error ? err.message : "流式分析中断" })
    }
  }).catch((err) => {
    if (err instanceof DOMException && err.name === "AbortError") return
    handlers.onError({ error: err instanceof Error ? err.message : "网络请求失败" })
  })

  return () => controller.abort()
}

export async function submitFeedback(analysisId: number, items: FeedbackItem[]): Promise<void> {
  const response = await fetch(`${API_BASE}/review/feedback/${analysisId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
  if (!response.ok) throw new Error("提交反馈失败")
}

export async function fetchRules(): Promise<CustomRule[]> {
  const response = await fetch(`${API_BASE}/review/rules`)
  if (!response.ok) throw new Error("获取规则列表失败")
  return response.json()
}

export async function createRule(data: Omit<CustomRule, "id" | "created_at" | "updated_at">): Promise<CustomRule> {
  const response = await fetch(`${API_BASE}/review/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || "创建规则失败")
  }
  return response.json()
}

export async function updateRule(
  id: number,
  data: Partial<Omit<CustomRule, "id" | "created_at" | "updated_at">>
): Promise<CustomRule> {
  const response = await fetch(`${API_BASE}/review/rules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || "更新规则失败")
  }
  return response.json()
}

export async function deleteRule(id: number): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE}/review/rules/${id}`, { method: "DELETE" })
  if (!response.ok) throw new Error("删除规则失败")
  return response.json()
}

export async function fetchTrends(days = 30): Promise<TrendResponse> {
  const response = await fetch(`${API_BASE}/review/trends?days=${days}`)
  if (!response.ok) throw new Error("获取趋势数据失败")
  return response.json()
}

export async function fetchSettingsStatus(): Promise<{ deepseek_configured: boolean; github_configured: boolean; deepseek_api_key?: string; github_token?: string }> {
  const response = await fetch(`${API_BASE}/settings/status`)
  if (!response.ok) throw new Error("获取设置状态失败")
  return response.json()
}

export async function updateSettings(data: { deepseek_api_key?: string; github_token?: string }): Promise<void> {
  const response = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error("更新设置失败")
}
