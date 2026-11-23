import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowUpRight, BellRing, FileText, Landmark, Plus } from 'lucide-react'
import { DemoNote } from '../../components/common/DemoNote'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { useApp } from '../../services/store'
import { AdminCollectionPage, type AdminFilter } from './AdminCollectionPage'
import type { Column } from '../../components/ui/Table'

type Scheme = ReturnType<typeof useApp>['schemes'][number]

export function SchemeManagementPage() {
  const { schemes, notify, createScheme } = useApp()
  const { show } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Income support')
  const [stateName, setStateName] = useState('All India')
  const [summary, setSummary] = useState('')
  const [eligibilityText, setEligibilityText] = useState('Small and marginal landholder farmers')
  const [documentsText, setDocumentsText] = useState('Aadhaar card, Bank passbook, Land record')
  const [sourceLabel, setSourceLabel] = useState('Official government portal')
  const [sourceUrl, setSourceUrl] = useState('https://www.india.gov.in/')
  const [tagsText, setTagsText] = useState('support, subsidy')

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || summary.trim().length < 10) {
      show('Check scheme details', 'Provide a scheme name and a summary of at least 10 characters.', 'warning')
      return
    }
    setSubmitting(true)
    try {
      const created = await createScheme({
        name: name.trim(),
        category: category.trim() || 'General',
        state: stateName.trim() || 'All India',
        summary: summary.trim(),
        eligibility: eligibilityText.split(',').map((s) => s.trim()).filter(Boolean),
        documents: documentsText.split(',').map((s) => s.trim()).filter(Boolean),
        sourceLabel: sourceLabel.trim() || 'Official portal',
        sourceUrl: sourceUrl.trim() || 'https://www.india.gov.in/',
        tags: tagsText.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      })
      setModalOpen(false)
      setName('')
      setSummary('')
      show('Scheme persisted', `${created.name} was added to the database catalogue.`, 'success')
    } catch (err) {
      show('Could not save scheme', err instanceof Error ? err.message : 'Validation failed.', 'critical')
    } finally {
      setSubmitting(false)
    }
  }

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
    <>
      <AdminCollectionPage
        eyebrow="Scheme catalogue"
        title="Scheme management"
        description="Manage the government scheme catalogue persisted in the database and broadcast announcements to farmers."
        rows={schemes}
        columns={columns}
        searchable={(row) => [row.name, row.category, row.state, row.summary, ...row.tags]}
        filters={filters}
        stats={[
          { label: 'Schemes', value: schemes.length, detail: 'Database entries', icon: <Landmark size={18} />, tone: 'sage' },
          { label: 'Categories', value: new Set(schemes.map((scheme) => scheme.category)).size, detail: 'Different support areas', icon: <FileText size={18} />, tone: 'forest' },
          { label: 'States', value: new Set(schemes.map((scheme) => scheme.state)).size, detail: 'Coverage labels', icon: <Landmark size={18} />, tone: 'neutral' },
          { label: 'Advisory', value: 'Verified Link', detail: 'Check official sources', icon: <FileText size={18} />, tone: 'alert' },
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
          description: (row) => `Broadcast a farmer notification about ${row.name} in the active notification feed?`,
          onConfirm: (row) => {
            notify({ title: `Scheme update: ${row.name}`, body: 'Review the catalogue entry and verify current details on the official source.', severity: 'info', audience: 'farmer' })
            show('Announcement persisted', `${row.name} was added to farmer notifications.`)
          },
        }}
        actions={
          <>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> Add scheme
            </Button>
            <a href="https://www.india.gov.in/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white/70 px-4 py-2 text-sm font-bold text-forest hover:border-sage"><BellRing size={14} /> Official directory <ArrowUpRight size={14} /></a>
          </>
        }
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add government scheme"
        description="Persist a new scheme catalogue entry to the backend database."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="scheme-create-form" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save scheme'}
            </Button>
          </>
        }
      >
        <form id="scheme-create-form" onSubmit={(e) => void handleCreate(e)} className="space-y-4">
          <Field label="Scheme name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Micro-Irrigation Subsidy" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" required>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </Field>
            <Field label="State / Coverage" required>
              <Input value={stateName} onChange={(e) => setStateName(e.target.value)} />
            </Field>
          </div>
          <Field label="Summary" required>
            <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Describe scheme benefits and scope..." />
          </Field>
          <Field label="Eligibility criteria (comma-separated)">
            <Input value={eligibilityText} onChange={(e) => setEligibilityText(e.target.value)} />
          </Field>
          <Field label="Required documents (comma-separated)">
            <Input value={documentsText} onChange={(e) => setDocumentsText(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source label">
              <Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} />
            </Field>
            <Field label="Official URL">
              <Input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
            </Field>
          </div>
          <Field label="Tags (comma-separated)">
            <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </Field>
        </form>
      </Modal>
    </>
  )
}
