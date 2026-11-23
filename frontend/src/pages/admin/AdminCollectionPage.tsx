import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Eye, ShieldAlert } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { FilterBar } from '../../components/common/FilterBar'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { DataTable } from '../../components/ui/Table'
import type { Column } from '../../components/ui/Table'
import { StatCard } from '../../components/common/StatCard'
import { useApp } from '../../services/store'

export interface AdminFilter<T> {
  label: string
  options: string[]
  value: (row: T) => string
}

export interface AdminConfirm<T> {
  label: string
  description: (row: T) => string
  onConfirm: (row: T) => void
  danger?: boolean
}

interface AdminCollectionPageProps<T extends { id: string }> {
  eyebrow: string
  title: string
  description: string
  rows: T[]
  columns: Column<T>[]
  searchable: (row: T) => string[]
  searchPlaceholder?: string
  filters?: AdminFilter<T>[]
  stats?: { label: string; value: string | number; detail?: string; icon: ReactNode; tone?: 'sage' | 'forest' | 'alert' | 'neutral' }[]
  actions?: ReactNode
  detailTitle?: (row: T) => string
  detailDescription?: string
  detailContent?: (row: T) => ReactNode
  confirm?: AdminConfirm<T>
  emptyMessage?: string
}

export function AdminCollectionPage<T extends { id: string }>({
  eyebrow,
  title,
  description,
  rows,
  columns,
  searchable,
  searchPlaceholder = 'Search records…',
  filters = [],
  stats = [],
  actions,
  detailTitle,
  detailDescription = 'Demo record details.',
  detailContent,
  confirm,
  emptyMessage,
}: AdminCollectionPageProps<T>) {
  const { settings } = useApp()
  const [query, setQuery] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.map((filter) => [filter.label, 'All'])),
  )
  const [detail, setDetail] = useState<T | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<T | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesQuery = !q || searchable(row).some((value) => value.toLowerCase().includes(q))
      const matchesFilters = filters.every((filter) => {
        const selected = filterValues[filter.label] ?? 'All'
        return selected === 'All' || selected === filter.value(row)
      })
      return matchesQuery && matchesFilters
    })
  }, [rows, query, searchable, filters, filterValues])

  const tableColumns = useMemo<Column<T>[]>(() => {
    const actionColumn: Column<T> = {
      key: '_actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          {detailContent ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation()
                setDetail(row)
              }}
            >
              <Eye size={13} /> View
            </Button>
          ) : null}
          {confirm ? (
            <Button
              type="button"
              size="sm"
              variant={confirm.danger ? 'danger' : 'secondary'}
              onClick={(event) => {
                event.stopPropagation()
                setPendingConfirm(row)
              }}
            >
              {confirm.label}
            </Button>
          ) : null}
        </div>
      ),
    }
    return [...columns, actionColumn]
  }, [columns, detailContent, confirm])

  const reset = () => {
    setQuery('')
    setFilterValues(Object.fromEntries(filters.map((filter) => [filter.label, 'All'])))
  }

  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} description={description} badge={<DemoNote label="Admin demo" />} actions={actions} />

      {stats.length > 0 ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} icon={stat.icon} tone={stat.tone ?? 'sage'} />
          ))}
        </div>
      ) : null}

      <FilterBar
        search={query}
        onSearch={setQuery}
        placeholder={searchPlaceholder}
        selects={filters.map((filter) => ({
          label: filter.label,
          value: filterValues[filter.label] ?? 'All',
          onChange: (value: string) => setFilterValues((current) => ({ ...current, [filter.label]: value })),
          options: [{ value: 'All', label: `All ${filter.label.toLowerCase()}` }, ...filter.options.map((option) => ({ value: option, label: option }))],
        }))}
        onReset={reset}
      >
        <span className="text-xs font-bold text-muted">{visible.length} of {rows.length} records shown</span>
      </FilterBar>

      <Card>
        <DataTable
          columns={tableColumns}
          rows={visible}
          rowKey={(row) => row.id}
          onRowClick={detailContent ? setDetail : undefined}
          compact={settings.compactTables}
          emptyMessage={emptyMessage ?? 'No records match the current filters.'}
        />
      </Card>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail && detailTitle ? detailTitle(detail) : 'Record details'}
        description={detailDescription}
        size="lg"
      >
        {detail && detailContent ? detailContent(detail) : null}
      </Modal>

      <Modal
        open={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        title={confirm?.label ?? 'Confirm action'}
        description="This is a demo action. No external system is contacted."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingConfirm(null)}>Cancel</Button>
            <Button
              variant={confirm?.danger ? 'danger' : 'primary'}
              onClick={() => {
                if (pendingConfirm && confirm) confirm.onConfirm(pendingConfirm)
                setPendingConfirm(null)
              }}
            >
              <ShieldAlert size={15} /> Confirm
            </Button>
          </>
        }
      >
        {pendingConfirm && confirm ? <p className="text-sm leading-relaxed text-ink">{confirm.description(pendingConfirm)}</p> : null}
      </Modal>
    </div>
  )
}
