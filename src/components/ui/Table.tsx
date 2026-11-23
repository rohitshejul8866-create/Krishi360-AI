import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
  compact?: boolean
  onRowClick?: (row: T) => void
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'No records match the current filters.',
  compact = false,
  onRowClick,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/40 px-6 py-12 text-center">
        <p className="text-sm font-semibold text-ink">{emptyMessage}</p>
        <p className="mt-1 text-xs text-muted">Try adjusting your search or filters.</p>
      </div>
    )
  }

  return (
    <div className="scroll-thin overflow-x-auto rounded-2xl border border-line/80">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="bg-soft-sage/45 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">
            {columns.map((column) => (
              <th key={column.key} className={`whitespace-nowrap px-4 py-3.5 ${column.className ?? ''}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70 bg-white/70">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`transition-colors hover:bg-soft-sage/25 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((column) => (
                <td key={column.key} className={`px-4 ${compact ? 'py-2.5' : 'py-4'} text-sm text-ink ${column.className ?? ''}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
