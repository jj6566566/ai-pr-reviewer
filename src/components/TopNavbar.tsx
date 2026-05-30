import { Search, Bot, ScanLine } from "lucide-react"
import { useStore } from "@/store/useStore"
import LoginButton from "@/components/LoginButton"

export default function TopNavbar() {
  const toggleSidebar = useStore((s) => s.toggleSidebar)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#0f1324] border-b border-[#1e2440]">
      <div className="flex items-center h-full px-4 md:px-6">
        <button
          onClick={toggleSidebar}
          className="mr-3 p-2 rounded-lg text-[#7b829c] hover:text-[#06d6a0] hover:bg-[#131829] transition-all"
        >
          <ScanLine size={20} />
        </button>

        <a href="/" className="flex items-center gap-2 flex-shrink-0 mr-6">
          <div className="relative">
            <Bot size={28} className="text-[#06d6a0]" />
            <ScanLine
              size={12}
              className="absolute -bottom-0.5 -right-0.5 text-[#7c3aed]"
            />
          </div>
          <span className="text-lg font-bold text-[#e4e8f1] tracking-tight">
            Review<span className="text-[#06d6a0]">AI</span>
          </span>
        </a>

        <div className="hidden md:flex items-center relative flex-1 max-w-[360px] mr-4">
          <div className="relative w-full">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5178] pointer-events-none"
            />
            <input
              type="text"
              placeholder="搜索 PRs 或粘贴链接..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] placeholder-[#4a5178] focus:outline-none focus:border-[#06d6a0] transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <LoginButton />
        </div>
      </div>
    </header>
  )
}
