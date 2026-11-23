import type { ReactNode } from 'react'
import { Reveal } from '../animations/Reveal'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  badge,
}: {
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
  badge?: ReactNode
}) {
  return (
    <Reveal className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-extrabold tracking-[0.16em] text-forest uppercase">{eyebrow}</span>
          {badge}
        </div>
        <h1 className="text-3xl font-extrabold tracking-[-0.045em] text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </Reveal>
  )
}
