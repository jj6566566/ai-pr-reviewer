import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get("token")
    if (token) {
      localStorage.setItem("pr_review_token", token)
      window.dispatchEvent(new Event("auth-changed"))
    }
    navigate("/", { replace: true })
  }, [searchParams, navigate])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#06d6a0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-[#7b829c]">正在完成登录...</p>
      </div>
    </div>
  )
}
