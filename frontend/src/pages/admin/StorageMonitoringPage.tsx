import { useState } from 'react'
import { ClipboardCheck, Thermometer, Warehouse, Droplets } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StatusPill } from '../../components/ui/Badge'
import { Field, Select, Textarea } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { DemoNote } from '../../components/common/DemoNote'
import { formatDateTime, formatNumber } from '../../services/utils'
import { useToast } from '../../context/ToastContext'
import { useApp } from '../../services/store'
import { AdminCollectionPage, type AdminFilter } from './AdminCollectionPage'
import type { Column } from '../../components/ui/Table'

type Batch = ReturnType<typeof useApp>['storageBatches'][number]

const statusFilter: AdminFilter<Batch> = { label: 'Status', options: ['normal', 'warning', 'critical'], value: (row) => row.status }
const cropFilter: AdminFilter<Batch> = { label: 'Crop', options: ['Wheat', 'Rice', 'Onion', 'Potato', 'Tomato', 'Grapes'], value: (row) => row.crop }

export function StorageMonitoringPage() {
  const { storageBatches, settings, addInspection } = useApp()
  const { show } = useToast()
  const [inspectionOpen, setInspectionOpen] = useState(false)
  const [batchId, setBatchId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const columns: Column<Batch>[] = [
    { key: 'code', label: 'Batch', render: (row) => <div><p className="font-bold text-ink">{row.code}</p><p className="text-xs text-muted">{row.crop}</p></div> },
    { key: 'location', label: 'Location', render: (row) => row.location },
    { key: 'quantity', label: 'Quantity', render: (row) => `${formatNumber(row.quantityKg)} kg` },
    { key: 'temp', label: 'Temperature', render: (row) => <span className={row.tempC > settings.storageAlertTemp ? 'font-bold text-alert' : 'text-ink'}>{row.tempC}°C</span> },
    { key: 'humidity', label: 'Humidity', render: (row) => <span className={row.humidity > settings.storageAlertHumidity ? 'font-bold text-alert' : 'text-ink'}>{row.humidity}%</span> },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
  ]

  const submitInspection = () => {
    const selected = batchId || storageBatches[0]?.id
    if (!selected || notes.trim().length < 8) {
      setError('Select a batch and enter at least 8 characters of inspection notes.')
      return
    }
    addInspection(selected, notes.trim(), 'Admin User')
    show('Inspection recorded', 'The demo inspection entry was added to the batch history.')
    setNotes('')
    setError('')
    setInspectionOpen(false)
  }

  return (
    <>
      <AdminCollectionPage
        eyebrow="Storage network"
        title="Storage monitoring"
        description="Review sample storage batches, simulated sensor values and inspection histories."
        rows={storageBatches}
        columns={columns}
        searchable={(row) => [row.code, row.crop, row.location, row.status]}
        filters={[statusFilter, cropFilter]}
        stats={[
          { label: 'Batches', value: storageBatches.length, detail: 'Under demo observation', icon: <Warehouse size={18} />, tone: 'sage' },
          { label: 'Normal', value: storageBatches.filter((row) => row.status === 'normal').length, detail: 'Within sample thresholds', icon: <Warehouse size={18} />, tone: 'forest' },
          { label: 'Warnings', value: storageBatches.filter((row) => row.status === 'warning').length, detail: 'Needs attention', icon: <Thermometer size={18} />, tone: 'alert' },
          { label: 'Inspections', value: storageBatches.reduce((total, row) => total + row.inspections.length, 0), detail: 'Logged in demo', icon: <ClipboardCheck size={18} />, tone: 'neutral' },
        ]}
        detailTitle={(row) => `${row.code} · ${row.crop}`}
        detailContent={(row) => (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Location</p><p className="font-semibold text-ink">{row.location}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Quantity</p><p className="font-semibold text-ink">{formatNumber(row.quantityKg)} kg</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Temperature</p><p className="font-semibold text-ink">{row.tempC}°C (limit {settings.storageAlertTemp}°C)</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Humidity</p><p className="font-semibold text-ink">{row.humidity}% (limit {settings.storageAlertHumidity}%)</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Safe range</p><p className="font-semibold text-ink">{row.minTemp}°C – {row.maxTemp}°C / ≤ {row.maxHumidity}%</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Status</p><StatusPill status={row.status} /></div>
            </div>
            <DemoNote label="Simulated sensor readings" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Inspection history</p>
              {row.inspections.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No inspections recorded yet.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {row.inspections.map((inspection) => (
                    <div key={inspection.id} className="rounded-2xl border border-line/80 bg-white/70 px-4 py-3">
                      <p className="text-sm font-semibold text-ink">{inspection.notes}</p>
                      <p className="mt-1 text-xs text-muted">{inspection.inspector} · {formatDateTime(inspection.date)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        confirm={{
          label: 'Quick check',
          description: (row) => `Add a standard demo inspection entry for batch ${row.code}?`,
          onConfirm: (row) => {
            addInspection(row.id, 'Routine demo inspection completed. Condition unchanged.', 'Admin User')
            show('Inspection recorded', `Standard check added to ${row.code}.`)
          },
        }}
        actions={<Button size="sm" variant="outline" onClick={() => { setBatchId(storageBatches[0]?.id ?? ''); setInspectionOpen(true) }}><ClipboardCheck size={14} /> Record inspection</Button>}
      />

      <Modal
        open={inspectionOpen}
        onClose={() => { setInspectionOpen(false); setError('') }}
        title="Record inspection"
        description="Add a local demo note to a storage batch."
        footer={<><Button variant="ghost" onClick={() => setInspectionOpen(false)}>Cancel</Button><Button onClick={submitInspection}>Save inspection</Button></>}
      >
        <div className="space-y-4">
          <Field label="Batch" required>
            <Select value={batchId} onChange={(event) => setBatchId(event.target.value)} options={storageBatches.map((batch) => ({ value: batch.id, label: `${batch.code} · ${batch.crop}` }))} />
          </Field>
          <Field label="Inspection notes" required error={error} hint="Describe the demo observation and any follow-up.">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Example: Ventilation checked; no visible spoilage." />
          </Field>
          <div className="flex items-center gap-2 rounded-2xl bg-soft-sage/60 px-4 py-3 text-xs font-semibold text-forest">
            <Droplets size={15} /> Sensor values in this portal are simulated for demonstration only.
          </div>
        </div>
      </Modal>
    </>
  )
}
