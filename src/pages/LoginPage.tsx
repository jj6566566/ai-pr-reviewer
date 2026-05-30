import { useState, useEffect } from "react"
import { Github, Shield, Zap, Code2, ArrowRight } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useNavigate, useSearchParams } from "react-router-dom"

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectTo = searchParams.get("redirect") || "/"

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo)
    }
  }, [isAuthenticated, navigate, redirectTo])

  const handleLogin = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await login()
    } catch (err) {
      setError("登录失败，请稍后重试")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#06d6a0] to-[#7c3aed] mb-6 shadow-lg shadow-[#06d6a0]/20">
            <Code2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-[#e4e8f1] mb-4">AI PR Review</h1>
          <p className="text-lg text-[#7b829c] max-w-md mx-auto">
            AI 驱动的代码评审助手，智能分析 PR 变更，提升代码质量
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-10">
          <div className="p-6 rounded-xl bg-gradient-to-br from-[#1e2440]/50 to-transparent border border-[#2d3560]">
            <div className="w-12 h-12 rounded-lg bg-[#06d6a0]/10 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-[#06d6a0]" />
            </div>
            <h3 className="text-sm font-semibold text-[#e4e8f1] mb-2">智能分析</h3>
            <p className="text-xs text-[#7b829c]">基于大语言模型的深度代码分析</p>
          </div>
          <div className="p-6 rounded-xl bg-gradient-to-br from-[#1e2440]/50 to-transparent border border-[#2d3560]">
            <div className="w-12 h-12 rounded-lg bg-[#7c3aed]/10 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-[#7c3aed]" />
            </div>
            <h3 className="text-sm font-semibold text-[#e4e8f1] mb-2">安全检测</h3>
            <p className="text-xs text-[#7b829c]">自动识别潜在安全风险和漏洞</p>
          </div>
          <div className="p-6 rounded-xl bg-gradient-to-br from-[#1e2440]/50 to-transparent border border-[#2d3560]">
            <div className="w-12 h-12 rounded-lg bg-[#fbbf24]/10 flex items-center justify-center mb-4">
              <Github className="w-6 h-6 text-[#fbbf24]" />
            </div>
            <h3 className="text-sm font-semibold text-[#e4e8f1] mb-2">GitHub 集成</h3>
            <p className="text-xs text-[#7b829c]">无缝对接 GitHub PR 流程</p>
          </div>
        </div>

        <div className="max-w-md mx-auto">
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 text-base font-semibold text-white bg-[#1e2440] border border-[#2d3560] rounded-xl hover:bg-[#2d3560] hover:border-[#06d6a0]/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <Github className="w-5 h-5" />
            <span>使用 GitHub 登录</span>
            <ArrowRight className="w-5 h-5 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
          </button>

          {isLoading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#7b829c]">
              <div className="w-4 h-4 border-2 border-[#06d6a0]/30 border-t-[#06d6a0] rounded-full animate-spin" />
              <span>正在跳转到 GitHub...</span>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/30 text-sm text-[#ef4444]">
              {error}
            </div>
          )}

          <p className="mt-6 text-center text-xs text-[#5a6175]">
            登录即表示您同意我们的服务条款和隐私政策
          </p>
        </div>
      </div>
    </div>
  )
}
