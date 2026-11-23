import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export function StatCard({
  label,
  value,
  detail,
  icon,
  tone = 'sage',
  onClick,
}: {
  label: string
  value: string | number
  detail?: string
  icon: ReactNode
  tone?: 'sage' | 'forest' | 'alert' | 'neutral'
  onClick?: () => void
}) {
  const reduceMotion = useReducedMotion()
  const iconTone =
    tone === 'alert'
      ? 'bg-[#FBE7E3] text-alert'
      : tone === 'forest'
        ? 'bg-forest text-white'
        : tone === 'neutral'
          ? 'bg-white text-muted'
          : 'bg-soft-sage text-forest'

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-extrabold tracking-[0.08em] text-muted uppercase">{label}</p>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${iconTone}`}>{icon}</span>
      </div>
      <p className="mt-4 text-2xl font-extrabold tracking-[-0.04em] text-ink sm:text-[28px]">{value}</p>
      {detail ? <p className="mt-1.5 text-xs leading-relaxed text-muted">{detail}</p> : null}
    </>
  )

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={reduceMotion ? undefined : { y: -4 }}
        whileTap={reduceMotion ? undefined : { scale: 0.99 }}
        className="clay-card clay-card-hover w-full p-5 text-left"
      >
        {content}
      </motion.button>
    )
  }

  return <div className="clay-card p-5">{content}</div>
}
