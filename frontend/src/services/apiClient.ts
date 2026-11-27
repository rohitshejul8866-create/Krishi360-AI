import type { ApiEnvelope } from '../types'

let authToken: string | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export function getAuthToken(): string | null {
  return authToken
}

export interface DevAuthOverride {
  id: string
  role: string
  name?: string
  provider?: 'express' | 'firebase'
}

export const apiClient = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',

  async request<T>(
    path: string,
    init?: RequestInit & { authUser?: DevAuthOverride | null },
  ): Promise<ApiEnvelope<T>> {
    const { authUser: _unused, headers: extraHeaders, ...fetchInit } = init ?? {}
    const headers = new Headers(extraHeaders)

    if (fetchInit.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    if (authToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${authToken}`)
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const response = await fetch(url, { ...fetchInit, headers })
    const text = await response.text()
    let parsed: unknown = null
    if (text) {
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = null
      }
    }

    if (!response.ok) {
      const msg =
        (parsed as { error?: { message?: string } } | null)?.error?.message ||
        `Request failed with status ${response.status}`
      throw new Error(msg)
    }

    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
      throw new Error(
        'Backend API server is not reachable at this URL. Use "Continue with Google" or set VITE_API_BASE_URL to your deployed AWS API endpoint.',
      )
    }

    return parsed as ApiEnvelope<T>
  },

  async get<T>(path: string, authUser?: DevAuthOverride | null): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, { method: 'GET', authUser })
  },

  async post<T>(path: string, body?: unknown, authUser?: DevAuthOverride | null): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      authUser,
    })
  },

  async put<T>(path: string, body?: unknown, authUser?: DevAuthOverride | null): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      authUser,
    })
  },

  async patch<T>(path: string, body?: unknown, authUser?: DevAuthOverride | null): Promise<ApiEnvelope<T>> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      authUser,
    })
  },
}
