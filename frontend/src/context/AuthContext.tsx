import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleAuthProvider } from '../lib/firebase'
import { apiClient, getAuthToken, setAuthToken } from '../services/apiClient'
import {
  authService,
  type AdminSetupInput,
  type FarmerLoginInput,
  type FarmerRegisterInput,
  type StaffLoginInput,
} from '../services/authService'
import {
  ensureFirebaseUserWorkspace,
  updateFirebaseProfile,
} from '../services/firestoreService'
import { useApp } from '../services/store'
import type { DemoUser } from '../types'

interface AuthContextValue {
  user: DemoUser | null
  authProvider: 'express' | 'firebase' | null
  loading: boolean
  restoring: boolean
  loginFarmer: (input: FarmerLoginInput) => Promise<DemoUser>
  registerFarmer: (input: FarmerRegisterInput) => Promise<DemoUser>
  loginStaff: (input: StaffLoginInput) => Promise<DemoUser>
  setupInitialAdmin: (input: AdminSetupInput) => Promise<DemoUser>
  loginWithGoogle: () => Promise<DemoUser>
  logout: () => void
  updateProfile: (patch: Partial<DemoUser>) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null)
  const [authProvider, setAuthProvider] = useState<'express' | 'firebase' | null>(null)
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(true)
  const { addAuditLog, addUser, syncBackendData } = useApp()

  useEffect(() => {
    let active = true
    const token = getAuthToken()

    if (token) {
      apiClient
        .get<DemoUser>('/me')
        .then((res) => {
          if (!active) return
          setUser(res.data)
          setAuthProvider('express')
        })
        .catch(() => {
          if (!active) return
          setAuthToken(null)
          setUser(null)
          setAuthProvider(null)
        })
        .finally(() => {
          if (active) setRestoring(false)
        })
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return
      if (fbUser && !getAuthToken()) {
        try {
          const demoUser = await ensureFirebaseUserWorkspace(fbUser)
          if (!active) return
          setUser(demoUser)
          setAuthProvider('firebase')
        } catch (err) {
          console.error('Firebase session restore failed:', err)
        } finally {
          if (active) setRestoring(false)
        }
      } else if (!getAuthToken()) {
        setRestoring(false)
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (user && authProvider) {
      void syncBackendData({
        id: user.id,
        role: user.role,
        name: user.name,
        provider: authProvider,
      })
    } else if (!restoring) {
      void syncBackendData(null)
    }
  }, [user, authProvider, restoring, syncBackendData])

  const loginFarmer = useCallback(
    async (input: FarmerLoginInput) => {
      setLoading(true)
      try {
        if (auth.currentUser) await signOut(auth)
        const next = await authService.loginFarmer(input)
        setUser(next)
        setAuthProvider('express')
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
        if (auth.currentUser) await signOut(auth)
        const next = await authService.registerFarmer(input)
        addUser(next)
        setUser(next)
        setAuthProvider('express')
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
        if (auth.currentUser) await signOut(auth)
        const next = await authService.loginStaff(input)
        setUser(next)
        setAuthProvider('express')
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
        if (auth.currentUser) await signOut(auth)
        const next = await authService.setupInitialAdmin(input)
        addUser(next)
        setUser(next)
        setAuthProvider('express')
        addAuditLog(next.name, next.role, 'Claimed initial admin credentials', 'Authentication')
        return next
      } finally {
        setLoading(false)
      }
    },
    [addAuditLog, addUser],
  )

  const loginWithGoogle = useCallback(async () => {
    setLoading(true)
    try {
      setAuthToken(null)
      const cred = await signInWithPopup(auth, googleAuthProvider)
      const next = await ensureFirebaseUserWorkspace(cred.user)
      setUser(next)
      setAuthProvider('firebase')
      addAuditLog(next.name, next.role, 'Signed in with Google', 'Firebase Authentication')
      return next
    } finally {
      setLoading(false)
    }
  }, [addAuditLog])

  const logout = useCallback(() => {
    if (user) addAuditLog(user.name, user.role, 'Signed out', 'Authentication')
    setAuthToken(null)
    if (auth.currentUser) {
      void signOut(auth)
    }
    setUser(null)
    setAuthProvider(null)
  }, [addAuditLog, user])

  const updateProfile = useCallback(
    async (patch: Partial<DemoUser>) => {
      if (authProvider === 'firebase' && auth.currentUser) {
        await updateFirebaseProfile(auth.currentUser.uid, {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.location !== undefined ? { location: patch.location } : {}),
          ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
          ...(patch.specialisation !== undefined ? { specialisation: patch.specialisation } : {}),
          ...(patch.organisation !== undefined ? { organisation: patch.organisation } : {}),
        })
        setUser((current) => (current ? { ...current, ...patch } : current))
        return
      }
      const updated = await authService.updateProfile({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.location !== undefined ? { location: patch.location } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.specialisation !== undefined ? { specialisation: patch.specialisation } : {}),
        ...(patch.organisation !== undefined ? { organisation: patch.organisation } : {}),
      })
      setUser(updated)
    },
    [authProvider],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authProvider,
      loading,
      restoring,
      loginFarmer,
      registerFarmer,
      loginStaff,
      setupInitialAdmin,
      loginWithGoogle,
      logout,
      updateProfile,
    }),
    [
      user,
      authProvider,
      loading,
      restoring,
      loginFarmer,
      registerFarmer,
      loginStaff,
      setupInitialAdmin,
      loginWithGoogle,
      logout,
      updateProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
