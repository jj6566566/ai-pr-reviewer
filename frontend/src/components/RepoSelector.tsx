import { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, FolderGit2, Lock, Globe } from 'lucide-react';
import { fetchRepos } from '../api/github';
import type { Repo } from '../types/auth';

interface RepoSelectorProps {
  onSelect: (owner: string, repo: string) => void;
}

export default function RepoSelector({ onSelect }: RepoSelectorProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const load = async (query?: string) => {
    setLoading(true);
    try {
      const data = await fetchRepos(query || undefined);
      setRepos(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSelect = (repo: Repo) => {
    setSelected(repo.full_name);
    setOpen(false);
    onSelect(repo.owner.login, repo.name);
  };

  const filtered = q
    ? repos.filter((r) => r.full_name.toLowerCase().includes(q.toLowerCase()))
    : repos;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                   bg-slate-800/60 border border-slate-700/50 text-slate-300
                   hover:border-slate-600/50 transition-colors text-left"
      >
        <FolderGit2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <span className={selected ? 'text-slate-200' : 'text-slate-500'}>
          {selected || '选择仓库...'}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); load(); }}
          className="ml-auto p-0.5 hover:text-slate-200 text-slate-500"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-slate-700/50 bg-slate-900 shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/50">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索仓库..."
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-500 text-center">
                {loading ? '加载中...' : '无匹配仓库'}
              </p>
            ) : (
              filtered.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => handleSelect(repo)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                             hover:bg-slate-800 transition-colors"
                >
                  {repo.private ? (
                    <Lock className="w-3.5 h-3.5 text-amber-500/70" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span className="text-slate-300">{repo.full_name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
