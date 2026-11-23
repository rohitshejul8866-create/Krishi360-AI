import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { setAuthToken } from '../services/apiClient'
import {
  authService,
  type AdminSetupInput,
  type FarmerLoginInput,
  type FarmerRegisterInput,
  type StaffLoginInput,
} from '../services/authService'
import { useApp } from '../services/store'
import type { DemoUser } from '../types'

interface AuthContextValue {
  user: DemoUser | null
  loading: boolean
  loginFarmer: (input: FarmerLoginInput) => Promise<DemoUser>
  registerFarmer: (input: FarmerRegisterInput) => Promise<DemoUser>
  loginStaff: (input: StaffLoginInput) => Promise<DemoUser>
  setupInitialAdmin: (input: AdminSetupInput) => Promise<DemoUser>
  logout: () => void
  updateProfile: (patch: Partial<DemoUser>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null)
  const [loading, setLoading] = useState(false)
  const { addAuditLog, addUser, syncBackendData } = useApp()

  useEffect(() => {
    if (user) {
      void syncBackendData({ id: user.id, role: user.role, name: user.name })
    } else {
      void syncBackendData(null)
    }
  }, [user, syncBackendData])

  const loginFarmer = useCallback(
    async (input: FarmerLoginInput) => {
      setLoading(true)
      try {
        const next = await authService.loginFarmer(input)
        setUser(next)
        addAuditLog(next.name, next.role, 'Farmer signed in', 'Authentication')
        return next
      } finally {
        setLoading(false)
      }
    },
    [addAuditLog],
  )

  const registerFarmer = useCallback(
    async (input: FarmerRegisterInput) => {
      setLoading(true)
      try {
        const next = await authService.registerFarmer(input)
        addUser(next)
        setUser(next)
        addAuditLog(next.name, next.role, 'Farmer registered account', 'Authentication')
        return next
      } finally {
        setLoading(false)
      }
    },
    [addAuditLog, addUser],
  )

  const loginStaff = useCallback(
    async (input: StaffLoginInput) => {
      setLoading(true)
      try {
        const next = await authService.loginStaff(input)
        setUser(next)
        addAuditLog(next.name, next.role, `Signed in to ${next.role} panel`, 'Authentication')
        return next
      } finally {
        setLoading(false)
      }
    },
    [addAuditLog],
  )

  const setupInitialAdmin = useCallback(
    async (input: AdminSetupInput) => {
      setLoading(true)
      try {
        const next = await authService.setupInitialAdmin(input)
        addUser(next)
        setUser(next)
        addAuditLog(next.name, next.role, 'Claimed initial admin credentials', 'Authentication')
        return next
      } finally {
        setLoading(false)
      }
    },
    [addAuditLog, addUser],
  )

  const logout = useCallback(() => {
    if (user) addAuditLog(user.name, user.role, 'Signed out', 'Authentication')
    setAuthToken(null)
    setUser(null)
  }, [addAuditLog, user])

  const updateProfile = useCallback((patch: Partial<DemoUser>) => {
    setUser((current) => (current ? { ...current, ...patch } : current))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      loginFarmer,
      registerFarmer,
      loginStaff,
      setupInitialAdmin,
      logout,
      updateProfile,
    }),
    [user, loading, loginFarmer, registerFarmer, loginStaff, setupInitialAdmin, logout, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
