import { useMemo, useState } from 'react'
import { ArrowRight, ClipboardList } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { FilterBar } from '../../components/common/FilterBar'
import { Card } from '../../components/ui/Card'
import { Badge, StatusPill } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/Table'
import type { Column } from '../../components/ui/Table'
import { useApp } from '../../services/store'
import { CROP_NAMES } from '../../data/crops'
import { formatDate } from '../../services/utils'
import type { CropCase } from '../../types'

export function AssignedCases() {
  const { cases } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [crop, setCrop] = useState('All crops')
  const [status, setStatus] = useState('All statuses')
  const [priority, setPriority] = useState('All priorities')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cases.filter((item) => {
      const matchesCrop = crop === 'All crops' || item.crop === crop
      const matchesStatus = status === 'All statuses' || item.reviewStatus === status.replace(' ', '_')
      const matchesPriority = priority === 'All priorities' || item.priority === priority.toLowerCase()
      const matchesQuery = !q || [item.id, item.farmerName, item.condition, item.location].some((value) => value.toLowerCase().includes(q))
      return matchesCrop && matchesStatus && matchesPriority && matchesQuery
    })
  }, [cases, query, crop, status, priority])

  const columns: Column<CropCase>[] = [
    { key: 'id', label: 'Case ID', render: (row) => <span className="font-extrabold text-ink">{row.id}</span> },
    { key: 'farmer', label: 'Farmer / location', render: (row) => <div><p className="font-bold text-ink">{row.farmerName}</p><p className="text-[11px] text-muted">{row.location}</p></div> },
    { key: 'crop', label: 'Crop', render: (row) => <Badge tone="sage">{row.crop}</Badge> },
    { key: 'condition', label: 'AI finding', render: (row) => row.condition },
    { key: 'priority', label: 'Priority', render: (row) => <StatusPill status={row.priority} /> },
    { key: 'review', label: 'Review', render: (row) => <StatusPill status={row.reviewStatus} /> },
    { key: 'date', label: 'Submitted', render: (row) => <span className="text-xs text-muted">{formatDate(row.submittedAt)}</span> },
    { key: 'action', label: 'Action', render: (row) => <button type="button" onClick={() => navigate(`/expert/case-details?id=${row.id}`)} className="inline-flex items-center gap-1 text-xs font-extrabold text-forest hover:underline">Open <ArrowRight size={13} /></button> },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Case workflow"
        title="Assigned Cases"
        description="Search and filter the demo case queue before opening a review."
        badge={<DemoNote label="Demo authorisation" />}
      />

      <FilterBar
        search={query}
        onSearch={setQuery}
        placeholder="Search case ID, farmer or finding…"
        selects={[
          { label: 'Crop', value: crop, onChange: setCrop, options: [{ value: 'All crops', label: 'All crops' }, ...CROP_NAMES.map((name) => ({ value: name, label: name }))] },
          { label: 'Status', value: status, onChange: setStatus, options: ['All statuses', 'pending', 'in review', 'completed', 'needs info'].map((name) => ({ value: name, label: name })) },
          { label: 'Priority', value: priority, onChange: setPriority, options: ['All priorities', 'High', 'Medium', 'Low'].map((name) => ({ value: name, label: name })) },
        ]}
        onReset={() => { setQuery(''); setCrop('All crops'); setStatus('All statuses'); setPriority('All priorities') }}
      >
        <span className="inline-flex items-center gap-2 text-xs font-bold text-muted"><ClipboardList size={14} /> {filtered.length} cases</span>
      </FilterBar>

      <Card>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/expert/case-details?id=${row.id}`)}
          emptyMessage="No cases match the current filters."
        />
      </Card>
    </div>
  )
}
