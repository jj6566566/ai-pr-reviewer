import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  SearchCode,
  GitPullRequest,
  Lightbulb,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import { useStore } from "@/store/useStore"
import { useAuth } from "@/contexts/AuthContext"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/analyze", icon: SearchCode, label: "PR 分析" },
  { to: "/review", icon: GitPullRequest, label: "评审队列" },
  { to: "/insights", icon: Lightbulb, label: "代码洞察" },
  { to: "/settings", icon: Settings, label: "系统设置" },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 pt-4 px-2 space-y-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? "bg-[#06d6a0]/10 text-[#06d6a0]"
                : "text-[#7b829c] hover:text-[#e4e8f1] hover:bg-[#131829]"
            }`
          }
        >
          <item.icon size={20} className="flex-shrink-0" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default function SideNav() {
  const {
    sidebarExpanded,
    setSidebarExpanded,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useStore()
  const { user } = useAuth()

  return (
    <>
      <div
        className={`hidden md:flex fixed top-16 left-0 bottom-0 bg-[#0f1324] border-r border-[#1e2440] z-40 transition-all duration-300 flex-col ${
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
        className={`hidden md:block flex-shrink-0 transition-all duration-300 ${
          sidebarExpanded ? "w-[240px]" : "w-[64px]"
        }`}
      />

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute top-16 left-0 bottom-0 w-[240px] bg-[#0f1324] border-r border-[#1e2440] flex flex-col animate-slide-in-left shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2440]">
              <span className="text-sm font-semibold text-[#e4e8f1]">导航菜单</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded text-[#7b829c] hover:text-[#e4e8f1] hover:bg-[#131829]"
              >
                <X size={18} />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
            {user && (
              <div className="px-4 pb-4 border-t border-[#1e2440] pt-3">
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
      )}
    </>
  )
}
