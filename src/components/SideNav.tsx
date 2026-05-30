import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  SearchCode,
  GitPullRequest,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useStore } from "@/store/useStore"
import { useAuth } from "@/contexts/AuthContext"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/analyze", icon: SearchCode, label: "PR 分析" },
  { to: "/review", icon: GitPullRequest, label: "评审队列" },
  { to: "/settings", icon: Settings, label: "系统设置" },
]

export default function SideNav() {
  const { sidebarExpanded, setSidebarExpanded } = useStore()
  const { user } = useAuth()

  return (
    <>
      <div
        className={`fixed top-16 left-0 bottom-0 bg-[#0f1324] border-r border-[#1e2440] z-40 transition-all duration-300 flex flex-col ${
          sidebarExpanded ? "w-[240px]" : "w-[64px]"
        }`}
      >
        <nav className="flex-1 pt-4 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#06d6a0]/10 text-[#06d6a0]"
                    : "text-[#7b829c] hover:text-[#e4e8f1] hover:bg-[#131829]"
                }`
              }
            >
              <item.icon size={20} className="flex-shrink-0" />
              {sidebarExpanded && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 pb-4">
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="flex items-center justify-center w-full p-2 rounded-lg text-[#7b829c] hover:text-[#e4e8f1] hover:bg-[#131829] transition-all"
          >
            {sidebarExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          {sidebarExpanded && user && (
            <div className="mt-3 border-t border-[#1e2440] pt-3 px-3">
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar_url ?? undefined}
                  alt={user.login}
                  className="w-8 h-8 rounded-full"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#e4e8f1] truncate">
                    {user.name || user.login}
                  </p>
                  <p className="text-[11px] text-[#7b829c]">{user.login}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className={`flex-shrink-0 transition-all duration-300 ${
          sidebarExpanded ? "w-[240px]" : "w-[64px]"
        }`}
      />
    </>
  )
}
