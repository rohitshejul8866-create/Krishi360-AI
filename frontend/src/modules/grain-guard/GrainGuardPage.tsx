import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, Boxes, CheckCircle2, ClipboardCheck, PackagePlus, Thermometer, Warehouse } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge, StatusPill } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { StatCard } from '../../components/common/StatCard'
import { Progress } from '../../components/ui/Progress'
import { DataTable } from '../../components/ui/Table'
import type { Column } from '../../components/ui/Table'
import { useApp } from '../../services/store'
import { useToast } from '../../context/ToastContext'
import { storageService } from '../../services/storageService'
import { CROP_NAMES } from '../../data/crops'
import { formatDate, formatNumber, makeId } from '../../services/utils'
import type { StorageBatch } from '../../types'

export function GrainGuardPage() {
  const { storageBatches, addStorageBatch, addInspection, addStorageReading } = useApp()
  const { show } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectionNote, setInspectionNote] = useState('')
  const [readingTemp, setReadingTemp] = useState(25)
  const [readingHumidity, setReadingHumidity] = useState(66)
  const [form, setForm] = useState({
    crop: CROP_NAMES[0],
    quantityKg: 5000,
    location: 'Warehouse A · Bay 5',
    tempC: 24,
    humidity: 65,
    minTemp: 12,
    maxTemp: 28,
    maxHumidity: 70,
  })

  const selected = useMemo(
    () => (selectedId ? storageBatches.find((item) => item.id === selectedId) ?? null : null),
    [selectedId, storageBatches],
  )

  const summary = useMemo(() => storageService.summary(storageBatches), [storageBatches])
  const alerts = storageBatches.filter((batch) => batch.status !== 'normal')

  const openBatch = (batch: StorageBatch) => {
    setSelectedId(batch.id)
    setReadingTemp(batch.tempC)
    setReadingHumidity(batch.humidity)
  }

  const columns: Column<StorageBatch>[] = [
    { key: 'code', label: 'Batch', render: (row) => <div><p className="font-bold text-ink">{row.code}</p><p className="text-[11px] text-muted">{row.crop}</p></div> },
    { key: 'qty', label: 'Quantity', render: (row) => `${formatNumber(row.quantityKg)} kg` },
    { key: 'location', label: 'Location', render: (row) => row.location },
    { key: 'temp', label: 'Temperature', render: (row) => <span className={row.tempC > row.maxTemp || row.tempC < row.minTemp ? 'font-bold text-alert' : ''}>{row.tempC}°C</span> },
    { key: 'humidity', label: 'Humidity', render: (row) => <span className={row.humidity > row.maxHumidity ? 'font-bold text-alert' : ''}>{row.humidity}% RH</span> },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
  ]

  const createBatch = async (event: FormEvent) => {
    event.preventDefault()
    const status = storageService.evaluate(form.tempC, form.humidity, form)
    const batch: StorageBatch = {
      id: makeId('batch'),
      code: `GB-${Math.floor(2400 + Math.random() * 900)}`,
      crop: form.crop,
      quantityKg: form.quantityKg,
      location: form.location,
      tempC: form.tempC,
      humidity: form.humidity,
      minTemp: form.minTemp,
      maxTemp: form.maxTemp,
      maxHumidity: form.maxHumidity,
      status,
      createdAt: new Date().toISOString(),
      inspections: [],
    }
    const created = await addStorageBatch(batch)
    setCreateOpen(false)
    show('Storage batch created', `${created.code} status: ${created.status} saved to backend.`, created.status === 'critical' ? 'critical' : 'success')
  }

  const logInspection = async () => {
    if (!selected || !inspectionNote.trim()) return show('Inspection note required', 'Add a short note before logging.', 'warning')
    await addInspection(selected.id, inspectionNote.trim(), 'Ramesh Patil')
    setInspectionNote('')
    show('Inspection logged', 'The record was saved to batch history.', 'success')
  }

  const logReading = async () => {
    if (!selected) return
    try {
      const res = await addStorageReading(selected.id, readingTemp, readingHumidity, 'simulated')
      show('Reading recorded', `${selected.code} evaluated as ${res.batchStatus.toUpperCase()}.`, res.batchStatus === 'critical' ? 'critical' : res.batchStatus === 'warning' ? 'warning' : 'success')
    } catch (err) {
      show('Unable to record reading', err instanceof Error ? err.message : 'Backend error.', 'critical')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Module 04 · Post-harvest"
        title="GrainGuard"
        description="Track stored produce against configurable demo thresholds and review simulated sensor values."
        badge={<DemoNote label="Simulated sensor readings" />}
        actions={<Button onClick={() => setCreateOpen(true)}><PackagePlus size={16} /> Create storage batch</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total batches" value={summary.total} detail="Across all demo stores" icon={<Boxes size={18} />} />
        <StatCard label="Normal" value={summary.normal} detail="Within thresholds" icon={<CheckCircle2 size={18} />} tone="forest" />
        <StatCard label="Warning" value={summary.warning} detail="Approaching threshold" icon={<AlertTriangle size={18} />} />
        <StatCard label="Critical" value={summary.critical} detail="Needs prompt attention" icon={<AlertTriangle size={18} />} tone="alert" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader title="Storage batches" description="Select a batch to view details and log an inspection." icon={<Warehouse size={18} />} />
          <DataTable columns={columns} rows={storageBatches} rowKey={(row) => row.id} onRowClick={openBatch} compact />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Alert history" description="Batches currently outside demo thresholds." icon={<AlertTriangle size={18} />} />
            <div className="space-y-3">
              {alerts.map((batch) => (
                <button key={batch.id} type="button" onClick={() => openBatch(batch)} className="w-full rounded-2xl border border-line/70 bg-white/60 p-4 text-left transition-colors hover:border-sage">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-extrabold text-ink">{batch.code} · {batch.crop}</p>
                    <StatusPill status={batch.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted">{storageService.statusMessage(batch.status)}</p>
                  <div className="mt-3 flex gap-4 text-xs font-semibold text-ink">
                    <span>{batch.tempC}°C</span><span>{batch.humidity}% RH</span>
                  </div>
                </button>
              ))}
              {alerts.length === 0 ? <p className="py-8 text-center text-sm text-muted">No active storage alerts.</p> : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Threshold model" description="How the demo status is computed." icon={<Thermometer size={18} />} />
            <div className="space-y-3 text-xs text-muted">
              <p>• Temperature below minimum or above maximum creates a warning.</p>
              <p>• Humidity above the configured maximum creates a warning.</p>
              <p>• Larger breaches or both breaches together become critical.</p>
              <p>• These thresholds are editable when creating a new batch.</p>
            </div>
            <div className="mt-5"><Progress value={Math.min(100, summary.normal / Math.max(1, summary.total) * 100)} label="Batches within threshold" /></div>
          </Card>
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create storage batch" description="Enter simulated readings and configurable thresholds." size="lg">
        <form id="batch-form" onSubmit={(event) => void createBatch(event)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Crop">
              <Select value={form.crop} onChange={(event) => setForm({ ...form, crop: event.target.value })} options={CROP_NAMES.map((name) => ({ value: name, label: name }))} />
            </Field>
            <Field label="Quantity (kg)">
              <Input type="number" min="1" value={form.quantityKg} onChange={(event) => setForm({ ...form, quantityKg: Number(event.target.value) })} />
            </Field>
            <Field label="Storage location">
              <Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            </Field>
            <Field label="Simulated temperature (°C)">
              <Input type="number" value={form.tempC} onChange={(event) => setForm({ ...form, tempC: Number(event.target.value) })} />
            </Field>
            <Field label="Simulated humidity (%)">
              <Input type="number" min="0" max="100" value={form.humidity} onChange={(event) => setForm({ ...form, humidity: Number(event.target.value) })} />
            </Field>
            <Field label="Minimum temp (°C)">
              <Input type="number" value={form.minTemp} onChange={(event) => setForm({ ...form, minTemp: Number(event.target.value) })} />
            </Field>
            <Field label="Maximum temp (°C)">
              <Input type="number" value={form.maxTemp} onChange={(event) => setForm({ ...form, maxTemp: Number(event.target.value) })} />
            </Field>
            <Field label="Maximum humidity (%)">
              <Input type="number" min="0" max="100" value={form.maxHumidity} onChange={(event) => setForm({ ...form, maxHumidity: Number(event.target.value) })} />
            </Field>
          </div>
          <div className={`rounded-2xl p-4 text-xs font-semibold ${storageService.evaluate(form.tempC, form.humidity, form) === 'normal' ? 'bg-soft-sage text-forest' : storageService.evaluate(form.tempC, form.humidity, form) === 'warning' ? 'bg-[#FBF1DC] text-[#8A6520]' : 'bg-[#FBE7E3] text-alert'}`}>
            Calculated demo status: {storageService.evaluate(form.tempC, form.humidity, form).toUpperCase()}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create batch</Button>
          </div>
        </form>
      </Modal>

      <Modal open={selected !== null} onClose={() => setSelectedId(null)} title={selected ? `${selected.code} · ${selected.crop}` : 'Batch details'} description="Simulated sensor record and inspection history." size="lg">
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status={selected.status} />
              <Badge tone="neutral">{formatNumber(selected.quantityKg)} kg</Badge>
              <Badge tone="neutral">{selected.location}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: 'Temperature', value: `${selected.tempC}°C` },
                { label: 'Humidity', value: `${selected.humidity}%` },
                { label: 'Temp range', value: `${selected.minTemp}–${selected.maxTemp}°C` },
                { label: 'Max humidity', value: `${selected.maxHumidity}%` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-soft-sage/45 p-4">
                  <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">{item.label}</p>
                  <p className="mt-1.5 text-sm font-extrabold text-ink">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-line/70 bg-white/60 p-4">
              <p className="text-xs font-extrabold tracking-wide text-ink uppercase">Log simulated sensor reading</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Temperature (°C)">
                  <Input type="number" step="0.1" value={readingTemp} onChange={(e) => setReadingTemp(Number(e.target.value))} />
                </Field>
                <Field label="Humidity (%)">
                  <Input type="number" min="0" max="100" value={readingHumidity} onChange={(e) => setReadingHumidity(Number(e.target.value))} />
                </Field>
                <Button size="sm" variant="outline" onClick={() => void logReading()}>Update reading</Button>
              </div>
            </div>
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-ink"><ClipboardCheck size={16} /> Inspection records</h3>
              <div className="space-y-2">
                {selected.inspections.map((inspection) => (
                  <div key={inspection.id} className="rounded-2xl border border-line/70 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold text-ink">{inspection.inspector}</p>
                      <p className="text-[11px] text-muted">{formatDate(inspection.date)}</p>
                    </div>
                    <p className="mt-2 text-xs text-muted">{inspection.notes}</p>
                  </div>
                ))}
                {selected.inspections.length === 0 ? <p className="text-xs text-muted">No inspections logged yet.</p> : null}
              </div>
            </div>
            <div className="rounded-2xl bg-soft-sage/40 p-4">
              <Field label="Add inspection note">
                <Textarea value={inspectionNote} onChange={(event) => setInspectionNote(event.target.value)} placeholder="Describe the observed storage condition…" />
              </Field>
              <div className="mt-3 flex justify-end"><Button size="sm" onClick={() => void logInspection()}>Log inspection</Button></div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
