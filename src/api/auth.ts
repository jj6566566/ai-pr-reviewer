import type { User } from "@/types/auth"

const API_BASE = "/api"

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("pr_review_token")
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

export async function getLoginUrl(redirect?: string): Promise<string> {
  const url = new URL(`${API_BASE}/auth/login`, window.location.origin)
  if (redirect) {
    url.searchParams.set("redirect", redirect)
  }
  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error("获取登录 URL 失败")
  }
  const data = await res.json()
  return data.url
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() })
    if (res.status === 401) {
      localStorage.removeItem("pr_review_token")
      return null
    }
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: authHeaders() })
  } finally {
    localStorage.removeItem("pr_review_token")
  }
}
