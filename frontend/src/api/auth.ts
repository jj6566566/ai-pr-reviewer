import type { User } from '../types/auth';

const API_BASE = '/api';

export async function getLoginUrl(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`);
  const data = await res.json();
  return data.url;
}

export async function getCurrentUser(): Promise<User | null> {
  const res = await fetch(`${API_BASE}/auth/me`);
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
}
