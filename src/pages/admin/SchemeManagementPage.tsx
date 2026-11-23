import { ArrowUpRight, BellRing, FileText, Landmark } from 'lucide-react'
import { DemoNote } from '../../components/common/DemoNote'
import { Badge } from '../../components/ui/Badge'
import { useToast } from '../../context/ToastContext'
import { useApp } from '../../services/store'
import { AdminCollectionPage, type AdminFilter } from './AdminCollectionPage'
import type { Column } from '../../components/ui/Table'

type Scheme = ReturnType<typeof useApp>['schemes'][number]

export function SchemeManagementPage() {
  const { schemes, notify } = useApp()
  const { show } = useToast()
  const filters: AdminFilter<Scheme>[] = [
    { label: 'Category', options: [...new Set(schemes.map((scheme) => scheme.category))], value: (row) => row.category },
    { label: 'State', options: [...new Set(schemes.map((scheme) => scheme.state))], value: (row) => row.state },
  ]

  const columns: Column<Scheme>[] = [
    { key: 'name', label: 'Scheme', render: (row) => <div><p className="font-bold text-ink">{row.name}</p><p className="text-xs text-muted">{row.category}</p></div> },
    { key: 'state', label: 'Coverage', render: (row) => row.state },
    { key: 'tags', label: 'Tags', render: (row) => <div className="flex flex-wrap gap-1">{row.tags.slice(0, 2).map((tag) => <Badge key={tag} tone="sage">{tag}</Badge>)}</div> },
    { key: 'source', label: 'Source', render: (row) => <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-forest underline">{row.sourceLabel} <ArrowUpRight size={12} /></a> },
  ]

  return (
    <AdminCollectionPage
      eyebrow="Scheme catalogue"
      title="Scheme management"
      description="Review the locally curated scheme catalogue and broadcast demo announcements to farmers."
      rows={schemes}
      columns={columns}
      searchable={(row) => [row.name, row.category, row.state, row.summary, ...row.tags]}
      filters={filters}
      stats={[
        { label: 'Schemes', value: schemes.length, detail: 'Curated demo entries', icon: <Landmark size={18} />, tone: 'sage' },
        { label: 'Categories', value: new Set(schemes.map((scheme) => scheme.category)).size, detail: 'Different support areas', icon: <FileText size={18} />, tone: 'forest' },
        { label: 'States', value: new Set(schemes.map((scheme) => scheme.state)).size, detail: 'Coverage labels', icon: <Landmark size={18} />, tone: 'neutral' },
        { label: 'Simulated', value: '100%', detail: 'No eligibility verification', icon: <FileText size={18} />, tone: 'alert' },
      ]}
      detailTitle={(row) => row.name}
      detailContent={(row) => (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Category</p><p className="font-semibold text-ink">{row.category}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Coverage</p><p className="font-semibold text-ink">{row.state}</p></div>
          </div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Summary</p><p className="mt-1 text-sm leading-relaxed text-ink">{row.summary}</p></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Indicative eligibility</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink">{row.eligibility.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Typical documents</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink">{row.documents.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="flex flex-wrap gap-2">{row.tags.map((tag) => <Badge key={tag} tone="sage">{tag}</Badge>)}</div>
          <DemoNote label="Verify on official source" />
          <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-forest underline">Open {row.sourceLabel} <ArrowUpRight size={14} /></a>
        </div>
      )}
      confirm={{
        label: 'Announce',
        description: (row) => `Create a demo farmer notification about ${row.name}? No external message is sent.`,
        onConfirm: (row) => {
          notify({ title: `Scheme update: ${row.name}`, body: 'Review the catalogue entry and verify current details on the official source.', severity: 'info', audience: 'farmer' })
          show('Demo announcement created', `${row.name} was added to farmer notifications.`)
        },
      }}
      actions={<a href="https://www.india.gov.in/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white/70 px-4 py-2 text-sm font-bold text-forest hover:border-sage"><BellRing size={14} /> Official directory <ArrowUpRight size={14} /></a>}
    />
  )
}
