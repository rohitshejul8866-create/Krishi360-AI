import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Droplets, MapPin, Pencil, Plus, Sprout } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard } from '../../components/common/StatCard'
import { Badge, StatusPill } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { Field, Input, Select } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Progress } from '../../components/ui/Progress'
import { useToast } from '../../context/ToastContext'
import { CROP_NAMES, GROWTH_STAGES } from '../../data/crops'
import { DEMO_FARM } from '../../data/farmers'
import { useApp } from '../../services/store'
import type { Plot } from '../../types'

const emptyPlot: Plot = {
  id: '',
  name: '',
  areaHa: 1,
  crop: CROP_NAMES[0],
  growthStage: GROWTH_STAGES[0],
  soilMoisture: 35,
  lastIrrigated: new Date().toISOString().slice(0, 10),
  status: 'healthy',
}

export function MyFarm() {
  const { farms, updateFarmPlots, backendConnected } = useApp()
  const activeFarm = farms[0]
  const farmMeta = activeFarm ?? DEMO_FARM

  const mapBackendPlots = (): Plot[] =>
    (activeFarm?.plots ?? DEMO_FARM.plots).map((plot) => ({
      id: plot.id,
      name: plot.name,
      areaHa: plot.areaHa,
      crop: plot.crop,
      growthStage: plot.growthStage,
      soilMoisture: plot.soilMoisture ?? 34,
      lastIrrigated: plot.lastIrrigated ?? new Date().toISOString().slice(0, 10),
      status: plot.status ?? 'healthy',
    }))

  const [plots, setPlots] = useState<Plot[]>(mapBackendPlots)
  const [editing, setEditing] = useState<Plot | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    setPlots(mapBackendPlots())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFarm?.id, activeFarm?.plots])

  const openNew = () => {
    setEditing({ ...emptyPlot, id: `plot-${Date.now()}` })
    setModalOpen(true)
  }

  const openEdit = (plot: Plot) => {
    setEditing({ ...plot })
    setModalOpen(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing || !editing.name.trim()) {
      show('Plot name required', 'Add a name before saving.', 'warning')
      return
    }
    const exists = plots.some((plot) => plot.id === editing.id)
    const nextPlots = exists
      ? plots.map((plot) => (plot.id === editing.id ? editing : plot))
      : [editing, ...plots]
    setPlots(nextPlots)

    if (activeFarm) {
      setSaving(true)
      try {
        await updateFarmPlots(activeFarm.id, nextPlots)
        show(exists ? 'Plot updated' : 'Plot added', `${editing.name} persisted to the farm database.`, 'success')
      } catch (err) {
        show(
          'Saved locally',
          err instanceof Error ? err.message : 'Unable to sync farm update to server.',
          'warning',
        )
      } finally {
        setSaving(false)
      }
    } else {
      show(exists ? 'Plot updated' : 'Plot added', `${editing.name} saved in this session.`, 'success')
    }
    setModalOpen(false)
  }

  const totalArea = plots.reduce((sum, plot) => sum + plot.areaHa, 0)

  return (
    <div>
      <PageHeader
        eyebrow="Farm records"
        title="My Farm"
        description="Review plots, soil context and crop stages persisted in the KRISHI360 backend database."
        badge={<Badge tone={backendConnected && activeFarm ? 'forest' : 'sage'}>{activeFarm ? 'Synced farm record' : 'Sample farm record'}</Badge>}
        actions={<Button onClick={openNew}><Plus size={16} /> Add plot</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Farm name" value={farmMeta.name} detail={farmMeta.location} icon={<MapPin size={18} />} />
        <StatCard label="Total area" value={`${totalArea.toFixed(1)} ha`} detail={`${plots.length} plots`} icon={<Sprout size={18} />} tone="forest" />
        <StatCard label="Soil type" value={farmMeta.soilType} detail="Persisted record" icon={<Droplets size={18} />} />
        <StatCard label="Irrigation" value={farmMeta.irrigationType} detail="Active configuration" icon={<Droplets size={18} />} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {plots.map((plot) => (
          <Card key={plot.id} className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge tone="sage">Plot</Badge>
                <h2 className="mt-3 text-lg font-extrabold tracking-tight text-ink">{plot.name}</h2>
                <p className="mt-1 text-xs text-muted">{plot.crop} · {plot.areaHa} ha · {plot.growthStage}</p>
              </div>
              <button type="button" onClick={() => openEdit(plot)} className="flex size-9 items-center justify-center rounded-xl bg-soft-sage text-forest hover:bg-sage/40" aria-label={`Edit ${plot.name}`}>
                <Pencil size={15} />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-soft-sage/45 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-extrabold tracking-wide text-muted uppercase">Soil moisture</p>
                  <StatusPill status={plot.status} />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-ink">{plot.soilMoisture}%</p>
                <div className="mt-3"><Progress value={plot.soilMoisture} /></div>
                <p className="mt-2 text-[10px] text-muted">Simulated / sensor reading</p>
              </div>
              <div className="rounded-2xl border border-line/70 p-4">
                <p className="text-[11px] font-extrabold tracking-wide text-muted uppercase">Last irrigation</p>
                <p className="mt-2 text-lg font-extrabold text-ink">{plot.lastIrrigated}</p>
                <p className="mt-3 text-xs text-muted">Crop: {plot.crop}</p>
                <p className="mt-1 text-xs text-muted">Stage: {plot.growthStage}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader title="Farm context" description="Information used by the irrigation recommendation engine." icon={<MapPin size={18} />} />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Location', value: farmMeta.location },
            { label: 'Soil type', value: farmMeta.soilType },
            { label: 'Irrigation method', value: farmMeta.irrigationType },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-soft-sage/40 p-4">
              <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">{item.label}</p>
              <p className="mt-2 text-sm font-bold text-ink">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={plots.some((plot) => plot.id === editing?.id) ? 'Edit plot' : 'Add a plot'}
        description="Update plot details and persist changes to your farm record."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="plot-form" disabled={saving}>{saving ? 'Saving…' : 'Save plot'}</Button>
          </>
        }
      >
        {editing ? (
          <form id="plot-form" onSubmit={(e) => void save(e)} className="space-y-4">
            <Field label="Plot name" required>
              <Input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Area (hectares)" required>
                <Input type="number" min="0.1" step="0.1" value={editing.areaHa} onChange={(event) => setEditing({ ...editing, areaHa: Number(event.target.value) })} />
              </Field>
              <Field label="Crop">
                <Select value={editing.crop} onChange={(event) => setEditing({ ...editing, crop: event.target.value })} options={CROP_NAMES.map((name) => ({ value: name, label: name }))} />
              </Field>
              <Field label="Growth stage">
                <Select value={editing.growthStage} onChange={(event) => setEditing({ ...editing, growthStage: event.target.value })} options={GROWTH_STAGES.map((stage) => ({ value: stage, label: stage }))} />
              </Field>
              <Field label="Condition">
                <Select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as Plot['status'] })} options={[
                  { value: 'healthy', label: 'Healthy' },
                  { value: 'watch', label: 'Watch' },
                  { value: 'attention', label: 'Needs attention' },
                ]} />
              </Field>
            </div>
            <Field label="Soil moisture (%)">
              <Input type="number" min="0" max="100" value={editing.soilMoisture} onChange={(event) => setEditing({ ...editing, soilMoisture: Number(event.target.value) })} />
            </Field>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
