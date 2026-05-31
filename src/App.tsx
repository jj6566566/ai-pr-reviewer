import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import TopNavbar from "@/components/TopNavbar"
import SideNav from "@/components/SideNav"
import PageTransition from "@/components/PageTransition"
import Dashboard from "@/pages/Dashboard"
import AnalyzePage from "@/pages/AnalyzePage"
import PRReview from "@/pages/PRReview"
import InsightsPage from "@/pages/InsightsPage"
import SettingsPage from "@/pages/SettingsPage"
import LoginPage from "@/pages/LoginPage"
import AuthCallback from "@/pages/AuthCallback"

function AppLayout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <TopNavbar />
      <div className="flex">
        <SideNav />
        <main className="flex-1 min-w-0 pt-16">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1440px]">
            <PageTransition key={location.pathname}>
              <Routes location={location}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/analyze" element={<AnalyzePage />} />
                <Route path="/review" element={<PRReview />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </PageTransition>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  )
}
