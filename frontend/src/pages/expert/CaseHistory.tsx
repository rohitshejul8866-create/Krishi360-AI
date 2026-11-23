import { useMemo, useState } from 'react'
import { History, MessageSquareText } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { FilterBar } from '../../components/common/FilterBar'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge, StatusPill } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/Table'
import type { Column } from '../../components/ui/Table'
import { Modal } from '../../components/ui/Modal'
import { useApp } from '../../services/store'
import { formatDate, formatDateTime } from '../../services/utils'
import type { CropCase } from '../../types'

export function CaseHistory() {
  const { cases } = useApp()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [selected, setSelected] = useState<CropCase | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cases.filter((item) => {
      const matchesStatus = status === 'All statuses' || item.reviewStatus === status.replace(' ', '_')
      const matchesQuery = !q || [item.id, item.farmerName, item.crop, item.condition].some((value) => value.toLowerCase().includes(q))
      return matchesQuery && matchesStatus
    })
  }, [cases, query, status])

  const columns: Column<CropCase>[] = [
    { key: 'id', label: 'Case', render: (row) => <span className="font-extrabold text-ink">{row.id}</span> },
    { key: 'farmer', label: 'Farmer', render: (row) => row.farmerName },
    { key: 'crop', label: 'Crop', render: (row) => <Badge tone="sage">{row.crop}</Badge> },
    { key: 'condition', label: 'Finding', render: (row) => row.condition },
    { key: 'status', label: 'Review status', render: (row) => <StatusPill status={row.reviewStatus} /> },
    { key: 'reviewed', label: 'Reviewed', render: (row) => <span className="text-xs text-muted">{row.reviewedAt ? formatDateTime(row.reviewedAt) : '—'}</span> },
    { key: 'reviewer', label: 'Reviewer', render: (row) => row.reviewedBy ?? '—' },
  ]

  return (
    <div>
      <PageHeader eyebrow="Case workflow" title="Case History" description="Review timestamps, statuses and recorded expert guidance." badge={<DemoNote label="Session history" />} />

      <FilterBar
        search={query}
        onSearch={setQuery}
        placeholder="Search case history…"
        selects={[{ label: 'Status', value: status, onChange: setStatus, options: ['All statuses', 'pending', 'in review', 'completed', 'needs info'].map((item) => ({ value: item, label: item })) }]}
        onReset={() => { setQuery(''); setStatus('All statuses') }}
      />

      <Card>
        <CardHeader title="All case records" description="Select a row to view the full review record." icon={<History size={18} />} />
        <DataTable columns={columns} rows={filtered} rowKey={(row) => row.id} onRowClick={setSelected} compact />
      </Card>

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected?.id ?? 'Case record'} description="Review details and guidance." size="lg">
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={selected.status} />
              <StatusPill status={selected.reviewStatus} />
              <Badge tone="neutral">{selected.crop}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-soft-sage/45 p-4">
                <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">Submitted</p>
                <p className="mt-1 text-sm font-bold text-ink">{formatDate(selected.submittedAt)}</p>
              </div>
              <div className="rounded-2xl bg-soft-sage/45 p-4">
                <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">Reviewed</p>
                <p className="mt-1 text-sm font-bold text-ink">{selected.reviewedAt ? formatDateTime(selected.reviewedAt) : 'Pending'}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <img src={selected.imageUrl} alt="Case evidence" className="aspect-square w-full rounded-2xl border border-line object-cover" />
              <div>
                <p className="text-sm font-extrabold text-ink">{selected.condition}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{selected.explanation}</p>
              </div>
            </div>
            {selected.expertNotes ? (
              <div className="rounded-2xl border border-line/70 p-4">
                <p className="flex items-center gap-2 text-xs font-extrabold text-forest"><MessageSquareText size={14} /> Expert observations</p>
                <p className="mt-2 text-sm text-ink">{selected.expertNotes}</p>
              </div>
            ) : null}
            {selected.expertGuidance ? (
              <div className="rounded-2xl bg-soft-sage/40 p-4">
                <p className="text-xs font-extrabold text-forest">Guidance shared with farmer</p>
                <p className="mt-2 text-sm text-ink">{selected.expertGuidance}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
