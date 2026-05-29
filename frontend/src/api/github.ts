import type { Repo, PullRequest } from '../types/auth';

const API_BASE = '/api';

export async function fetchRepos(q?: string): Promise<Repo[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const res = await fetch(`${API_BASE}/github/repos?${params}`);
  if (!res.ok) throw new Error('获取仓库列表失败');
  return res.json();
}

export async function fetchRepoPulls(owner: string, repo: string): Promise<PullRequest[]> {
  const res = await fetch(`${API_BASE}/github/repos/${owner}/${repo}/pulls`);
  if (!res.ok) throw new Error('获取 PR 列表失败');
  return res.json();
}
