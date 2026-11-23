import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  interactive?: boolean
  padded?: boolean
}

export function Card({ children, interactive = false, padded = true, className = '', ...props }: CardProps) {
  return (
    <div
      className={`clay-card ${interactive ? 'clay-card-hover' : ''} ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-soft-sage text-forest">
            {icon}
          </span>
        ) : null}
        <div>
          <h3 className="text-base font-bold tracking-tight text-ink sm:text-lg">{title}</h3>
          {description ? <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}
