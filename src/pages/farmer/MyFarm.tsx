import { useState } from 'react'
import type { FormEvent } from 'react'
import { Droplets, MapPin, Pencil, Plus, Sprout } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge, StatusPill } from '../../components/ui/Badge'
import { Progress } from '../../components/ui/Progress'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { StatCard } from '../../components/common/StatCard'
import { useToast } from '../../context/ToastContext'
import { DEMO_FARM } from '../../data/farmers'
import { CROP_NAMES, GROWTH_STAGES } from '../../data/crops'
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
  const [plots, setPlots] = useState<Plot[]>(() => DEMO_FARM.plots.map((plot) => ({ ...plot })))
  const [editing, setEditing] = useState<Plot | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const { show } = useToast()

  const openNew = () => {
    setEditing({ ...emptyPlot, id: `plot-${Date.now()}` })
    setModalOpen(true)
  }

  const openEdit = (plot: Plot) => {
    setEditing({ ...plot })
    setModalOpen(true)
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!editing || !editing.name.trim()) {
      show('Plot name required', 'Add a name before saving.', 'warning')
      return
    }
    const exists = plots.some((plot) => plot.id === editing.id)
    setPlots((current) => (exists ? current.map((plot) => (plot.id === editing.id ? editing : plot)) : [editing, ...current]))
    setModalOpen(false)
    show(exists ? 'Plot updated' : 'Plot added', `${editing.name} saved in this demo session.`, 'success')
  }

  const totalArea = plots.reduce((sum, plot) => sum + plot.areaHa, 0)

  return (
    <div>
      <PageHeader
        eyebrow="Farm records"
        title="My Farm"
        description="Review plots, soil context and crop stages. Edits are stored only for this demo session."
        badge={<DemoNote label="Sample farm record" />}
        actions={<Button onClick={openNew}><Plus size={16} /> Add plot</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Farm name" value={DEMO_FARM.name} detail={DEMO_FARM.location} icon={<MapPin size={18} />} />
        <StatCard label="Total area" value={`${totalArea.toFixed(1)} ha`} detail={`${plots.length} plots`} icon={<Sprout size={18} />} tone="forest" />
        <StatCard label="Soil type" value={DEMO_FARM.soilType} detail="Sample record" icon={<Droplets size={18} />} />
        <StatCard label="Irrigation" value={DEMO_FARM.irrigationType} detail="Configured in demo" icon={<Droplets size={18} />} />
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
                <p className="mt-2 text-[10px] text-muted">Simulated reading</p>
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
        <CardHeader title="Farm context" description="Information used by the demo recommendation engines." icon={<MapPin size={18} />} />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Location', value: DEMO_FARM.location },
            { label: 'Soil type', value: DEMO_FARM.soilType },
            { label: 'Irrigation method', value: DEMO_FARM.irrigationType },
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
        description="Update the sample plot details used across your demo workspace."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="plot-form">Save plot</Button>
          </>
        }
      >
        {editing ? (
          <form id="plot-form" onSubmit={save} className="space-y-4">
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
            <Field label="Simulated soil moisture (%)">
              <Input type="number" min="0" max="100" value={editing.soilMoisture} onChange={(event) => setEditing({ ...editing, soilMoisture: Number(event.target.value) })} />
            </Field>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
