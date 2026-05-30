import { Github, LogOut } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

export default function LoginButton() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-[#1e2440] animate-pulse" />
        <div className="w-16 h-4 rounded bg-[#1e2440] animate-pulse hidden md:block" />
      </div>
    )
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        <img
          src={user.avatar_url ?? undefined}
          alt={user.login}
          className="w-8 h-8 rounded-full border border-[#1e2440]"
        />
        <span className="hidden md:block text-sm font-medium text-[#e4e8f1]">
          {user.name || user.login}
        </span>
        <button
          onClick={logout}
          className="p-1.5 rounded-lg text-[#7b829c] hover:text-[#ef4444] hover:bg-[#131829] transition-all"
          title="退出登录"
        >
          <LogOut size={16} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={login}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#e4e8f1] bg-[#1e2440] border border-[#2d3560] rounded-lg hover:bg-[#2d3560] hover:border-[#06d6a0]/30 transition-all"
    >
      <Github size={16} />
      <span className="hidden md:inline">GitHub 登录</span>
    </button>
  )
}
