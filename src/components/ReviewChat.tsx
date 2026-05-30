import { useState, useRef, useEffect, useCallback } from "react"
import {
  Send,
  Bot,
  User,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react"
import type { RiskItem, SuggestionItem } from "@/types/review"
import { authHeaders } from "@/api/auth"

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */
interface ReviewChatProps {
  analysisId: number
  repoOwner: string
  repoName: string
  prTitle: string
  summary: string
  riskItems: RiskItem[]
  suggestions: SuggestionItem[]
}

/* ------------------------------------------------------------------ */
/*  Internal types                                                     */
/* ------------------------------------------------------------------ */
interface ChatMessage {
  role: "user" | "ai"
  content: string
}

/* ------------------------------------------------------------------ */
/*  SSE ask helper — returns an abort function                         */
/* ------------------------------------------------------------------ */
function askAI(
  analysisId: number,
  question: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  signal?: AbortSignal,
): () => void {
  const controller = new AbortController()
  const combinedSignal = signal
    ? (() => {
        signal.addEventListener("abort", () => controller.abort())
        return controller.signal
      })()
    : controller.signal

  fetch(`/api/review/${analysisId}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ question }),
    signal: combinedSignal,
  })
    .then(async (response) => {
      try {
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({} as Record<string, unknown>))
          const detail =
            typeof (errBody as { detail?: string }).detail === "string"
              ? (errBody as { detail?: string }).detail
              : `HTTP ${response.status}`
          onError(detail)
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          onError("无法读取响应流")
          return
        }

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          // SSE lines are separated by \n
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            if (trimmed.startsWith("data:")) {
              const jsonStr = trimmed.slice(5).trim()
              if (!jsonStr) continue
              try {
                const parsed = JSON.parse(jsonStr)
                if (typeof parsed.token === "string") {
                  onToken(parsed.token)
                } else if (typeof parsed === "string") {
                  onToken(parsed)
                }
              } catch {
                onToken(jsonStr)
              }
            } else if (trimmed.startsWith("event: error") || trimmed.startsWith("event:done")) {
              continue
            }
          }
        }

        const remaining = buffer.trim()
        if (remaining.startsWith("data:")) {
          const jsonStr = remaining.slice(5).trim()
          if (jsonStr) {
            try {
              const parsed = JSON.parse(jsonStr)
              if (typeof parsed.token === "string") {
                onToken(parsed.token)
              } else if (typeof parsed === "string") {
                onToken(parsed)
              }
            } catch {
              onToken(jsonStr)
            }
          }
        }

        onDone()
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        onError(err instanceof Error ? err.message : "流式响应中断")
      }
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return
      onError(err instanceof Error ? err.message : "网络请求失败")
    })

  return () => controller.abort()
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */
export default function ReviewChat({
  analysisId,
  repoOwner,
  repoName,
  prTitle,
}: ReviewChatProps) {
  /* ---- state ---- */
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ---- refs ---- */
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<(() => void) | null>(null)

  /* ---- scroll to bottom when messages change ---- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  /* ---- focus input when opening ---- */
  useEffect(() => {
    if (isOpen) {
      // Small delay for the collapse animation
      const timer = setTimeout(() => inputRef.current?.focus(), 150)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  /* ---- abort stream on unmount or close ---- */
  useEffect(() => {
    return () => {
      abortRef.current?.()
    }
  }, [])

  const handleClose = useCallback(() => {
    abortRef.current?.()
    setIsStreaming(false)
    setIsOpen(false)
  }, [])

  /* ---- send message ---- */
  const handleSend = useCallback(async () => {
    const question = inputValue.trim()
    if (!question || isStreaming) return

    // Abort any previous stream
    abortRef.current?.()

    setError(null)
    setInputValue("")

    const userMsg: ChatMessage = { role: "user", content: question }
    const aiPlaceholder: ChatMessage = { role: "ai", content: "" }

    setMessages((prev) => [...prev, userMsg, aiPlaceholder])
    setIsStreaming(true)

    abortRef.current = askAI(
      analysisId,
      question,
      (token) => {
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === "ai") {
            updated[updated.length - 1] = { ...last, content: last.content + token }
          }
          return updated
        })
      },
      () => {
        setIsStreaming(false)
        abortRef.current = null
      },
      (err) => {
        setError(err)
        setIsStreaming(false)
        // Replace the empty ai placeholder with error message
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === "ai" && last.content === "") {
            updated[updated.length - 1] = {
              ...last,
              content: `请求失败：${err}`,
            }
          }
          return updated
        })
        abortRef.current = null
      },
    )
  }, [inputValue, isStreaming, analysisId])

  /* ---- handle Enter key ---- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  /* ---- render ---- */
  const hasMessages = messages.length > 0

  return (
    <div className="bg-[#131829] border border-[#1e2440] rounded-xl overflow-hidden transition-all duration-300">
      {/* ================================================================ */}
      {/*  Collapsed header — always visible                               */}
      {/* ================================================================ */}
      <button
        type="button"
        onClick={() => (isOpen ? handleClose() : setIsOpen(true))}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#0a0e1a] transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          <MessageSquare size={18} className="text-[#06d6a0]" />
          <span className="text-sm font-semibold text-[#e4e8f1] group-hover:text-[#06d6a0] transition-colors">
            追问 AI
          </span>
          {!isOpen && messages.length > 0 && (
            <span className="text-xs text-[#7b829c] bg-[#1e2440] rounded-full px-2 py-0.5">
              {messages.length}
            </span>
          )}
          {isStreaming && !isOpen && (
            <Loader2 size={14} className="text-[#06d6a0] animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#4a5178] hidden sm:inline">
            {repoOwner}/{repoName} &middot; {prTitle.length > 24 ? prTitle.slice(0, 24) + "..." : prTitle}
          </span>
          {isOpen ? (
            <ChevronUp size={16} className="text-[#7b829c] group-hover:text-[#e4e8f1] transition-colors" />
          ) : (
            <ChevronDown size={16} className="text-[#7b829c] group-hover:text-[#e4e8f1] transition-colors" />
          )}
        </div>
      </button>

      {/* ================================================================ */}
      {/*  Expanded panel                                                  */}
      {/* ================================================================ */}
      {isOpen && (
        <div className="border-t border-[#1e2440] animate-slide-up">
          {/* ---------- messages area ---------- */}
          <div className="h-[340px] overflow-y-auto px-4 py-4 space-y-4">
            {!hasMessages && !error && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <Bot size={40} className="text-[#06d6a0]/30 mb-4" />
                <p className="text-sm text-[#7b829c] leading-relaxed">
                  基于对 <span className="text-[#e4e8f1] font-medium">{repoOwner}/{repoName}</span> 中
                  PR 的评审分析，你可以向我提出任何代码相关的问题。
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {[
                    "最严重的安全风险是什么？",
                    "有哪些性能问题？",
                    "代码架构有什么改进空间？",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => { setInputValue(q); inputRef.current?.focus() }}
                      className="text-xs px-3 py-1.5 rounded-full border border-[#1e2440] bg-[#0f1425] text-[#7b829c] hover:border-[#06d6a0]/40 hover:text-[#06d6a0] hover:bg-[#06d6a0]/5 transition-all duration-200"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => {
              const isUser = msg.role === "user"
              const isLastAi = !isUser && idx === messages.length - 1
              const isEmptyAi = !isUser && msg.content === ""

              return (
                <div
                  key={idx}
                  className={`flex ${isUser ? "justify-end" : "justify-start"} animate-message-in`}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  {/* AI avatar */}
                  {!isUser && (
                    <div className="flex-shrink-0 mr-2 mt-1">
                      <div className="w-7 h-7 rounded-full bg-[#06d6a0]/10 border border-[#06d6a0]/20 flex items-center justify-center">
                        <Bot size={14} className="text-[#06d6a0]" />
                      </div>
                    </div>
                  )}

                  {/* message bubble */}
                  <div
                    className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                      isUser
                        ? "bg-[#1e2440] text-[#e4e8f1] rounded-br-md"
                        : "bg-[#06d6a0]/10 border border-[#06d6a0]/20 text-[#e4e8f1] rounded-bl-md"
                    }`}
                  >
                    {isEmptyAi && isLastAi && isStreaming ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#06d6a0] animate-typing-dot" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#06d6a0] animate-typing-dot" style={{ animationDelay: "0.15s" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#06d6a0] animate-typing-dot" style={{ animationDelay: "0.3s" }} />
                      </span>
                    ) : isEmptyAi ? (
                      <span className="text-[#7b829c] italic">空响应</span>
                    ) : (
                      <span>{msg.content}</span>
                    )}
                  </div>

                  {/* User avatar */}
                  {isUser && (
                    <div className="flex-shrink-0 ml-2 mt-1">
                      <div className="w-7 h-7 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center">
                        <User size={14} className="text-[#3b82f6]" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* error banner */}
            {error && (
              <div className="flex justify-center">
                <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg px-4 py-2 text-xs text-[#ef4444] max-w-[80%] text-center">
                  {error}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ---------- input area ---------- */}
          <div className="border-t border-[#1e2440] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isStreaming
                    ? "AI 正在回复..."
                    : "输入你的追问..."
                }
                disabled={isStreaming}
                className="flex-1 h-10 px-3.5 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] placeholder-[#4a5178] focus:outline-none focus:border-[#06d6a0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputValue.trim() || isStreaming}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[#06d6a0] text-[#0f1324] hover:bg-[#05c495] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="发送"
              >
                {isStreaming ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
