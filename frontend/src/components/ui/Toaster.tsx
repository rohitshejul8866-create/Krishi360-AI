import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import type { Severity } from '../../types'

const icons: Record<Severity, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  critical: XCircle,
}

const colors: Record<Severity, string> = {
  success: 'text-forest bg-soft-sage',
  info: 'text-forest bg-white',
  warning: 'text-[#8A6520] bg-[#FBF1DC]',
  critical: 'text-alert bg-[#FBE7E3]',
}

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-200 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.severity]
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="glass-panel pointer-events-auto flex items-start gap-3 rounded-2xl p-3.5"
              role="status"
            >
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${colors[toast.severity]}`}>
                <Icon size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">{toast.title}</p>
                {toast.description ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{toast.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="text-muted transition-colors hover:text-ink"
              >
                <X size={15} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
