import { useState, useEffect, useRef } from "react"
import { Search, Globe, Lock, RefreshCw, Loader2 } from "lucide-react"
import type { Repo } from "@/types/auth"
import { fetchRepos } from "@/api/github"

interface RepoSelectorProps {
  onSelect: (owner: string, repo: string) => void
  disabled?: boolean
}

export default function RepoSelector({ onSelect, disabled }: RepoSelectorProps) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const loadRepos = () => {
    setLoading(true)
    fetchRepos()
      .then(setRepos)
      .catch(() => setRepos([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadRepos()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(q.toLowerCase())
  )

  const handleSelect = (repo: Repo) => {
    const [owner, name] = repo.full_name.split("/")
    setSelected(repo.full_name)
    setOpen(false)
    onSelect(owner, name)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-2 w-full h-10 px-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-lg text-[#e4e8f1] hover:border-[#06d6a0]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {selected ? (
          <span className="flex-1 text-left">{selected}</span>
        ) : (
          <span className="flex-1 text-left text-[#4a5178]">选择仓库...</span>
        )}
        {loading ? (
          <Loader2 size={14} className="animate-spin text-[#7b829c]" />
        ) : (
          <RefreshCw
            size={14}
            className="text-[#7b829c] hover:text-[#e4e8f1] cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              loadRepos()
            }}
          />
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-[#0f1324] border border-[#1e2440] rounded-lg shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-[#1e2440]">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4a5178]" />
              <input
                type="text"
                placeholder="搜索仓库..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-sm bg-[#0a0e1a] border border-[#1e2440] rounded-md text-[#e4e8f1] placeholder-[#4a5178] focus:outline-none focus:border-[#06d6a0]"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-[#7b829c]">
                {loading ? "加载中..." : "没有找到仓库"}
              </div>
            ) : (
              filtered.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => handleSelect(repo)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-[#131829] transition-colors ${
                    selected === repo.full_name ? "text-[#06d6a0] bg-[#06d6a0]/5" : "text-[#e4e8f1]"
                  }`}
                >
                  {repo.private ? (
                    <Lock size={13} className="text-[#f59e0b] flex-shrink-0" />
                  ) : (
                    <Globe size={13} className="text-[#7b829c] flex-shrink-0" />
                  )}
                  <span className="truncate">{repo.full_name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
