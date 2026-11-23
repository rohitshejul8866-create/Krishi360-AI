import type { ReactNode } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { Input, Select } from '../ui/Input'
import type { SelectOption } from '../ui/Input'

export interface FilterSelect {
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
}

export function FilterBar({
  search,
  onSearch,
  placeholder = 'Search…',
  selects = [],
  onReset,
  children,
}: {
  search: string
  onSearch: (value: string) => void
  placeholder?: string
  selects?: FilterSelect[]
  onReset?: () => void
  children?: ReactNode
}) {
  return (
    <div className="clay-card mb-5 flex flex-col gap-3 p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(200px,1.3fr)_repeat(auto-fit,minmax(150px,1fr))]">
        <div className="relative">
          <Search size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} className="pl-11" />
        </div>
        {selects.map((filter) => (
          <Select key={filter.label} value={filter.value} onChange={(event) => filter.onChange(event.target.value)} options={filter.options} aria-label={filter.label} />
        ))}
      </div>
      {(onReset || children) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
          {children}
          {onReset ? (
            <button type="button" onClick={onReset} className="inline-flex items-center gap-2 text-xs font-bold text-muted transition-colors hover:text-forest">
              <RotateCcw size={13} /> Reset filters
            </button>
          ) : <span />}
        </div>
      )}
    </div>
  )
}
