import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'
import { AppProvider } from './services/store'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { Toaster } from './components/ui/Toaster'
import { PageTransition } from './components/animations/PageTransition'
import { FarmerLayout } from './layouts/FarmerLayout'
import { ExpertLayout } from './layouts/ExpertLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { LandingPage } from './pages/landing/LandingPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { StaffLoginPage } from './pages/auth/StaffLoginPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { OnboardingPage } from './pages/auth/OnboardingPage'
import { FarmerDashboard } from './pages/farmer/FarmerDashboard'
import { MyFarm } from './pages/farmer/MyFarm'
import { MyCrops } from './pages/farmer/MyCrops'
import { AssistantPage } from './pages/farmer/AssistantPage'
import { NotificationsPage } from './pages/farmer/NotificationsPage'
import { ProfilePage } from './pages/farmer/ProfilePage'
import { SettingsPage } from './pages/farmer/SettingsPage'
import { CropDoctorPage } from './modules/crop-doctor/CropDoctorPage'
import { MandiSmartPage } from './modules/mandi-smart/MandiSmartPage'
import { JalSensePage } from './modules/jal-sense/JalSensePage'
import { GrainGuardPage } from './modules/grain-guard/GrainGuardPage'
import { SchemeSaathiPage } from './modules/scheme-saathi/SchemeSaathiPage'
import { ExpertDashboard } from './pages/expert/ExpertDashboard'
import { AssignedCases } from './pages/expert/AssignedCases'
import { CaseDetails } from './pages/expert/CaseDetails'
import { AIAnalysisReview } from './pages/expert/AIAnalysisReview'
import { ExpertFeedback } from './pages/expert/ExpertFeedback'
import { CaseHistory } from './pages/expert/CaseHistory'
import { ExpertProfile } from './pages/expert/ExpertProfile'
import { ExpertSettings } from './pages/expert/ExpertSettings'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { UserManagementPage } from './pages/admin/UserManagementPage'
import { FarmerManagementPage } from './pages/admin/FarmerManagementPage'
import { ExpertManagementPage } from './pages/admin/ExpertManagementPage'
import { CropCaseManagementPage } from './pages/admin/CropCaseManagementPage'
import { MandiDataManagementPage } from './pages/admin/MandiDataManagementPage'
import { StorageMonitoringPage } from './pages/admin/StorageMonitoringPage'
import { SchemeManagementPage } from './pages/admin/SchemeManagementPage'
import { ReportsAnalyticsPage } from './pages/admin/ReportsAnalyticsPage'
import { AuditLogsPage } from './pages/admin/AuditLogsPage'
import { BackendDatabasePage } from './pages/admin/BackendDatabasePage'
import { PlatformSettingsPage } from './pages/admin/PlatformSettingsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import type { Role } from './types'

const homeFor: Record<Role, string> = {
  farmer: '/farmer/dashboard',
  expert: '/expert/dashboard',
  admin: '/admin/dashboard',
}

function Animated({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}

function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      return
    }
    const id = decodeURIComponent(hash.slice(1))
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pathname, hash])

  return null
}

function RoleHome() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homeFor[user.role]} replace />
}

function AppRoutes() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Animated><LandingPage /></Animated>} />
        <Route path="/login" element={<Animated><LoginPage /></Animated>} />
        <Route path="/register" element={<Animated><RegisterPage /></Animated>} />
        <Route path="/admin/login" element={<Animated><StaffLoginPage defaultRole="admin" /></Animated>} />
        <Route path="/expert/login" element={<Animated><StaffLoginPage defaultRole="expert" /></Animated>} />
        <Route path="/staff-login" element={<Animated><StaffLoginPage defaultRole="admin" /></Animated>} />
        <Route path="/role-select" element={<Navigate to="/register" replace />} />
        <Route path="/forgot-password" element={<Animated><ForgotPasswordPage /></Animated>} />
        <Route path="/reset-password" element={<Animated><ResetPasswordPage /></Animated>} />
        <Route path="/onboarding" element={<Animated><OnboardingPage /></Animated>} />
        <Route path="/dashboard" element={<RoleHome />} />

        <Route path="/farmer" element={<FarmerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Animated><FarmerDashboard /></Animated>} />
          <Route path="my-farm" element={<Animated><MyFarm /></Animated>} />
          <Route path="my-crops" element={<Animated><MyCrops /></Animated>} />
          <Route path="crop-doctor" element={<Animated><CropDoctorPage /></Animated>} />
          <Route path="mandi-smart" element={<Animated><MandiSmartPage /></Animated>} />
          <Route path="jal-sense" element={<Animated><JalSensePage /></Animated>} />
          <Route path="grain-guard" element={<Animated><GrainGuardPage /></Animated>} />
          <Route path="scheme-saathi" element={<Animated><SchemeSaathiPage /></Animated>} />
          <Route path="assistant" element={<Animated><AssistantPage /></Animated>} />
          <Route path="notifications" element={<Animated><NotificationsPage /></Animated>} />
          <Route path="profile" element={<Animated><ProfilePage /></Animated>} />
          <Route path="settings" element={<Animated><SettingsPage /></Animated>} />
        </Route>

        <Route path="/expert" element={<ExpertLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Animated><ExpertDashboard /></Animated>} />
          <Route path="cases" element={<Animated><AssignedCases /></Animated>} />
          <Route path="case-details" element={<Animated><CaseDetails /></Animated>} />
          <Route path="ai-review" element={<Animated><AIAnalysisReview /></Animated>} />
          <Route path="feedback" element={<Animated><ExpertFeedback /></Animated>} />
          <Route path="history" element={<Animated><CaseHistory /></Animated>} />
          <Route path="profile" element={<Animated><ExpertProfile /></Animated>} />
          <Route path="settings" element={<Animated><ExpertSettings /></Animated>} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Animated><AdminDashboard /></Animated>} />
          <Route path="users" element={<Animated><UserManagementPage /></Animated>} />
          <Route path="farmers" element={<Animated><FarmerManagementPage /></Animated>} />
          <Route path="experts" element={<Animated><ExpertManagementPage /></Animated>} />
          <Route path="cases" element={<Animated><CropCaseManagementPage /></Animated>} />
          <Route path="mandi" element={<Animated><MandiDataManagementPage /></Animated>} />
          <Route path="storage" element={<Animated><StorageMonitoringPage /></Animated>} />
          <Route path="schemes" element={<Animated><SchemeManagementPage /></Animated>} />
          <Route path="analytics" element={<Animated><ReportsAnalyticsPage /></Animated>} />
          <Route path="audit-logs" element={<Animated><AuditLogsPage /></Animated>} />
          <Route path="backend" element={<Animated><BackendDatabasePage /></Animated>} />
          <Route path="settings" element={<Animated><PlatformSettingsPage /></Animated>} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </>
  )
}

function QuotaExceededBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onQuotaExceeded = () => setVisible(true)
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded)
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded)
  }, [])

  if (!visible) return null

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-950 shadow-sm"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={16} className="shrink-0 text-amber-700" />
          <p className="font-medium leading-snug">
            The shared Google Maps Platform demo quota has reached its temporary limit or authorization restriction. Interactive map tiles may pause until quota resets.{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline hover:text-amber-800"
            >
              Learn how to attach your own Cloud API key
            </a>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-lg p-1 text-amber-700 hover:bg-amber-100"
          aria-label="Dismiss map quota notice"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <QuotaExceededBanner />
        <ToastProvider>
          <AppProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </AppProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
