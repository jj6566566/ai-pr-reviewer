import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get("token")
    const redirectTo = searchParams.get("redirect") || "/"
    
    if (token) {
      localStorage.setItem("pr_review_token", token)
      window.dispatchEvent(new Event("auth-changed"))
      navigate(redirectTo, { replace: true })
    } else {
      const errorMsg = searchParams.get("error")
      if (errorMsg) {
        setError(decodeURIComponent(errorMsg))
      } else {
        setError("登录失败，未获取到授权信息")
      }
    }
  }, [searchParams, navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-[#ef4444]/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[#e4e8f1] mb-2">登录失败</h2>
          <p className="text-[#7b829c] mb-6">{error}</p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2 bg-[#06d6a0] text-white rounded-lg hover:bg-[#06d6a0]/80 transition-colors"
          >
            返回登录页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#06d6a0]/30 border-t-[#06d6a0] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#e4e8f1] mb-2">正在完成登录...</p>
        <p className="text-sm text-[#7b829c]">即将跳转到应用页面</p>
      </div>
    </div>
  )
}
