import { Activity, CheckCircle2, Clock3, TriangleAlert } from 'lucide-react'
import { DemoNote } from '../../components/common/DemoNote'
import { StatusPill } from '../../components/ui/Badge'
import { formatDate } from '../../services/utils'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../services/store'
import { AdminCollectionPage, type AdminFilter } from './AdminCollectionPage'
import type { Column } from '../../components/ui/Table'

type AdminCase = ReturnType<typeof useApp>['cases'][number]

const statusFilter: AdminFilter<AdminCase> = { label: 'Status', options: ['new', 'ai_review', 'expert_review', 'resolved'], value: (row) => row.status }
const priorityFilter: AdminFilter<AdminCase> = { label: 'Priority', options: ['high', 'medium', 'low'], value: (row) => row.priority }
const cropFilter: AdminFilter<AdminCase> = { label: 'Crop', options: ['Tomato', 'Wheat', 'Grapes', 'Onion', 'Rice', 'Cotton', 'Maize', 'Potato'], value: (row) => row.crop }

export function CropCaseManagementPage() {
  const { user } = useAuth()
  const { cases, reviewCase } = useApp()
  const columns: Column<AdminCase>[] = [
    { key: 'id', label: 'Case', render: (row) => <div><p className="font-bold text-ink">{row.id}</p><p className="text-xs text-muted">{formatDate(row.submittedAt)}</p></div> },
    { key: 'farmer', label: 'Farmer', render: (row) => <div><p className="font-semibold text-ink">{row.farmerName}</p><p className="text-xs text-muted">{row.location}</p></div> },
    { key: 'crop', label: 'Crop / issue', render: (row) => <div><p className="font-semibold text-ink">{row.crop}</p><p className="text-xs text-muted">{row.condition}</p></div> },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'priority', label: 'Priority', render: (row) => <StatusPill status={row.priority} /> },
  ]
  return (
    <AdminCollectionPage
      eyebrow="Operations"
      title="Crop case management"
      description="Monitor simulated diagnosis cases and expert-review states across the platform."
      rows={cases}
      columns={columns}
      searchable={(row) => [row.id, row.farmerName, row.crop, row.condition, row.location]}
      filters={[statusFilter, priorityFilter, cropFilter]}
      stats={[
        { label: 'Total cases', value: cases.length, detail: 'Submitted in demo', icon: <Activity size={18} />, tone: 'sage' },
        { label: 'Awaiting review', value: cases.filter((item) => item.status !== 'resolved').length, detail: 'Open or in review', icon: <Clock3 size={18} />, tone: 'forest' },
        { label: 'High priority', value: cases.filter((item) => item.priority === 'high').length, detail: 'Needs attention', icon: <TriangleAlert size={18} />, tone: 'alert' },
        { label: 'Resolved', value: cases.filter((item) => item.status === 'resolved').length, detail: 'Expert guidance shared', icon: <CheckCircle2 size={18} />, tone: 'neutral' },
      ]}
      detailTitle={(row) => `${row.id} · ${row.crop}`}
      detailContent={(row) => (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Farmer</p><p className="font-semibold text-ink">{row.farmerName}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Location</p><p className="font-semibold text-ink">{row.location}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Condition</p><p className="font-semibold text-ink">{row.condition}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Status</p><StatusPill status={row.status} /></div>
          </div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Symptoms</p><p className="mt-1 text-sm leading-relaxed text-ink">{row.symptoms}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Explanation</p><p className="mt-1 text-sm leading-relaxed text-ink">{row.explanation}</p></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Next steps</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink">{row.nextSteps.map((step) => <li key={step}>{step}</li>)}</ul>
          </div>
          <DemoNote label="Simulated diagnosis" />
        </div>
      )}
      confirm={{
        label: 'Toggle resolution',
        description: (row) => `${row.status === 'resolved' ? 'Reopen' : 'Mark resolved'} case ${row.id} in the local demo store? No farmer is notified.`,
        onConfirm: (row) =>
          reviewCase(
            row.id,
            row.expertNotes ?? 'Admin demo update.',
            row.expertGuidance ?? 'Continue monitoring and consult a local expert before applying any treatment.',
            row.status === 'resolved' ? 'in_review' : 'completed',
            user?.name ?? 'Admin User',
          ),
      }}
    />
  )
}
