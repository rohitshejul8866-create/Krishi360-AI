import type { ReactNode } from 'react'

export function Stagger({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
  stagger?: number
}) {
  return <div className={className}>{children}</div>
}

export function StaggerItem({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
  y?: number
}) {
  return <div className={className}>{children}</div>
}
