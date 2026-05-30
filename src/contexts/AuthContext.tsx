import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { getCurrentUser, getLoginUrl, logout as apiLogout } from "@/api/auth"
import type { User } from "@/types/auth"

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (redirect?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const u = await getCurrentUser()
        setUser(u)
      } finally {
        setIsLoading(false)
      }
    }
    fetchUser()

    const handleAuthChanged = () => {
      getCurrentUser().then((u) => setUser(u))
    }
    window.addEventListener("auth-changed", handleAuthChanged)
    return () => window.removeEventListener("auth-changed", handleAuthChanged)
  }, [])

  const login = useCallback(async (redirect?: string) => {
    const url = await getLoginUrl(redirect)
    window.location.href = url
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
