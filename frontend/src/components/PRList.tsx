import { useState, useEffect } from 'react';
import { GitPullRequest, Clock } from 'lucide-react';
import { fetchRepoPulls } from '../api/github';
import type { PullRequest as PRType } from '../types/auth';

interface PRListProps {
  owner: string;
  repo: string;
  onSelectPR: (owner: string, repo: string, number: number) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return `${Math.floor(days / 7)}周前`;
}

export default function PRList({ owner, repo, onSelectPR }: PRListProps) {
  const [prs, setPrs] = useState<PRType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchRepoPulls(owner, repo);
        if (!cancelled) setPrs(data.filter((p: PRType) => p.state === 'open'));
      } catch {
        if (!cancelled) setError('加载 PR 列表失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [owner, repo]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4 animate-pulse">
        <div className="h-4 bg-slate-700/50 rounded w-32 mb-2" />
        <div className="h-3 bg-slate-700/30 rounded w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-950/10 p-4">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (prs.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4 text-center">
        <p className="text-sm text-slate-500">该仓库暂无 Open PR</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700/50 flex items-center gap-2">
        <GitPullRequest className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-medium text-slate-300">{owner}/{repo}</span>
        <span className="text-xs text-slate-600">{prs.length} 个 PR</span>
      </div>
      <div className="divide-y divide-slate-700/30">
        {prs.map((pr) => (
          <button
            key={pr.number}
            type="button"
            onClick={() => onSelectPR(owner, repo, pr.number)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left
                       hover:bg-slate-700/30 transition-colors"
          >
            <span className="text-xs text-slate-500 font-mono">#{pr.number}</span>
            <span className="flex-1 text-sm text-slate-300 truncate">{pr.title}</span>
            <span className="flex items-center gap-1 text-xs text-slate-600 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {timeAgo(pr.created_at)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
