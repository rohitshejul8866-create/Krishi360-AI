import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types'

const homeFor: Record<Role, string> = {
  farmer: '/farmer/dashboard',
  expert: '/expert/dashboard',
  admin: '/admin/dashboard',
}

const loginFor: Record<Role, string> = {
  farmer: '/login',
  expert: '/expert/login',
  admin: '/admin/login',
}

export function ProtectedRoute({ children, allowedRole }: { children: ReactNode; allowedRole: Role }) {
  const { user } = useAuth()

  if (!user) return <Navigate to={loginFor[allowedRole]} replace />
  if (user.role !== allowedRole) return <Navigate to={homeFor[user.role]} replace />
  return <>{children}</>
}
