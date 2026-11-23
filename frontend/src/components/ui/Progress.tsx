import { motion, useReducedMotion } from 'framer-motion'

export function Progress({ value, label, tone = 'sage' }: { value: number; label?: string; tone?: 'sage' | 'forest' | 'alert' }) {
  const reduceMotion = useReducedMotion()
  const color = tone === 'alert' ? 'bg-alert' : tone === 'forest' ? 'bg-forest' : 'bg-sage'
  return (
    <div>
      {label ? (
        <div className="mb-2 flex items-center justify-between text-xs font-semibold">
          <span className="text-ink">{label}</span>
          <span className="text-muted">{Math.round(value)}%</span>
        </div>
      ) : null}
      <div className="h-2.5 w-full overflow-hidden rounded-full inset-field" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: reduceMotion ? 0 : 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
