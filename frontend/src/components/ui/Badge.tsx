import type { ReactNode } from 'react'

export type Tone = 'neutral' | 'sage' | 'forest' | 'warning' | 'critical' | 'success' | 'info'

const tones: Record<Tone, string> = {
  neutral: 'bg-white text-muted border-line',
  sage: 'bg-soft-sage text-forest border-sage/40',
  forest: 'bg-forest text-white border-forest',
  warning: 'bg-[#FBF1DC] text-[#8A6520] border-[#EAD7A8]',
  critical: 'bg-[#FBE7E3] text-alert border-[#F3C4BC]',
  success: 'bg-soft-sage text-forest border-sage/50',
  info: 'bg-white text-forest border-sage/50',
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
  icon,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  icon?: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${tones[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  )
}

export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/[\s_]+/g, '-')
  const tone: Tone = normalized.includes('critical') || normalized.includes('high') || normalized.includes('overdue')
    ? 'critical'
    : normalized.includes('warning') || normalized.includes('pending') || normalized.includes('review') || normalized.includes('invited')
      ? 'warning'
      : normalized.includes('normal') || normalized.includes('resolved') || normalized.includes('completed') || normalized.includes('active')
        ? 'success'
        : normalized.includes('new') || normalized.includes('info')
          ? 'info'
          : 'neutral'

  return <Badge tone={tone}>{status.replace(/_/g, ' ')}</Badge>
}
