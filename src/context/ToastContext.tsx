import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Severity } from '../types'

export interface ToastMessage {
  id: string
  title: string
  description?: string
  severity: Severity
}

interface ToastContextValue {
  toasts: ToastMessage[]
  show: (title: string, description?: string, severity?: Severity) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (title: string, description?: string, severity: Severity = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setToasts((current) => [...current, { id, title, description, severity }])
      window.setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(() => ({ toasts, show, dismiss }), [toasts, show, dismiss])

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
