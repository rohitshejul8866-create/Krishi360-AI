import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  }

  static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'An unexpected application error occurred.'
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string }
      if (parsed && parsed.error && parsed.operationType) {
        message = `Database ${parsed.operationType} error${parsed.path ? ` (${parsed.path})` : ''}: ${parsed.error}`
      }
    } catch {
      // Non-JSON error message
    }
    return { hasError: true, message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F6F8F5] p-6">
          <div className="max-w-md rounded-3xl border border-[#F3C4BC] bg-white p-8 text-center shadow-xl">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#FBE7E3] text-[#C44536]">
              <AlertTriangle size={22} />
            </span>
            <h1 className="mt-4 text-lg font-extrabold text-[#1E2A1F]">Something went wrong</h1>
            <p className="mt-2 text-xs leading-relaxed text-[#5C6B5D]">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#344B35] px-5 py-2.5 text-xs font-extrabold text-white transition hover:opacity-95"
            >
              <RefreshCw size={14} /> Reload application
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
