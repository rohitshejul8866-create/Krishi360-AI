import type { ReactNode } from 'react'

export function Reveal({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  once?: boolean
  immediate?: boolean
}) {
  return <div className={className}>{children}</div>
}
