import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export interface TabItem {
  id: string
  label: string
  icon?: ReactNode
}

export function Tabs({
  items,
  activeId,
  onChange,
  className = '',
}: {
  items: TabItem[]
  activeId: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={`hide-scrollbar flex gap-1 overflow-x-auto rounded-2xl inset-field p-1.5 ${className}`} role="tablist">
      {items.map((item) => {
        const active = item.id === activeId
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors sm:text-sm ${
              active ? 'text-forest' : 'text-muted hover:text-ink'
            }`}
          >
            {active ? (
              <motion.span
                layoutId="active-tab"
                className="absolute inset-0 rounded-xl bg-white shadow-[0_6px_16px_-10px_rgba(38,51,40,0.6)]"
                transition={{ type: 'spring', stiffness: 420, damping: 35 }}
              />
            ) : null}
            <span className="relative z-10 flex items-center gap-2">
              {item.icon}
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
