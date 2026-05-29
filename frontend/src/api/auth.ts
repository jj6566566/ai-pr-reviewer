import type { User } from '../types/auth';

const API_BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('pr_review_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export async function getLoginUrl(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`);
  const data = await res.json();
  return data.url;
}

export async function getCurrentUser(): Promise<User | null> {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: authHeaders() });
}
