import type { DemoUser, Role, UserStatus } from '../types'
import { apiClient, setAuthToken } from './apiClient'

export interface FarmerLoginInput {
  email: string
  password: string
}

export interface FarmerRegisterInput {
  name: string
  email: string
  password: string
  location: string
  phone?: string
}

export interface StaffLoginInput {
  email: string
  password: string
  role: 'expert' | 'admin'
}

export interface AdminSetupInput {
  name: string
  email: string
  password: string
}

export interface AdminCreateUserInput {
  name: string
  email: string
  password: string
  role: Role
  location: string
  phone: string
  specialisation?: string
  organisation?: string
}

interface AuthSessionPayload {
  token: string
  user: DemoUser
}

interface BootstrapStatusPayload {
  adminSetupRequired: boolean
  adminEmailHint: string
}

export const authService = {
  async getBootstrapStatus(): Promise<BootstrapStatusPayload> {
    const res = await apiClient.get<BootstrapStatusPayload>('/auth/bootstrap-status')
    return res.data
  },

  async setupInitialAdmin(input: AdminSetupInput): Promise<DemoUser> {
    const res = await apiClient.post<AuthSessionPayload>('/auth/setup-admin', input)
    setAuthToken(res.data.token)
    return res.data.user
  },

  async loginFarmer(input: FarmerLoginInput): Promise<DemoUser> {
    if (!input.email.trim() || !input.password) {
      throw new Error('Enter your farmer email and password.')
    }
    const res = await apiClient.post<AuthSessionPayload>('/auth/login', input)
    setAuthToken(res.data.token)
    return res.data.user
  },

  async registerFarmer(input: FarmerRegisterInput): Promise<DemoUser> {
    if (!input.name.trim() || !input.email.trim() || !input.password) {
      throw new Error('Full name, email, and password are required.')
    }
    const res = await apiClient.post<AuthSessionPayload>('/auth/register', {
      name: input.name.trim(),
      email: input.email.trim(),
      password: input.password,
      location: input.location.trim() || 'India',
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
    })
    setAuthToken(res.data.token)
    return res.data.user
  },

  async loginStaff(input: StaffLoginInput): Promise<DemoUser> {
    if (!input.email.trim() || !input.password) {
      throw new Error('Enter your email and password.')
    }
    const res = await apiClient.post<AuthSessionPayload>('/auth/staff-login', input)
    setAuthToken(res.data.token)
    return res.data.user
  },

  async adminCreateUser(input: AdminCreateUserInput): Promise<DemoUser> {
    const res = await apiClient.post<DemoUser>('/admin/users', input)
    return res.data
  },

  async adminUpdateUserStatus(id: string, status: UserStatus): Promise<DemoUser> {
    const res = await apiClient.post<DemoUser>(`/admin/users/${encodeURIComponent(id)}/status`, { status })
    return res.data
  },

  async requestPasswordReset(email: string): Promise<void> {
    if (!email.includes('@')) throw new Error('Enter a valid email address.')
    await apiClient.get('/health')
  },

  async resetPassword(password: string, confirmPassword: string): Promise<void> {
    if (password.length < 8) throw new Error('Use at least 8 characters.')
    if (password !== confirmPassword) throw new Error('Passwords do not match.')
    await apiClient.get('/health')
  },
}
