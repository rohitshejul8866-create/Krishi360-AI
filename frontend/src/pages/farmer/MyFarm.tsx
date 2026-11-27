import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Droplets, MapPin, Pencil, Plus, Sprout, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard } from '../../components/common/StatCard'
import { Badge, StatusPill } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { Field, Input, Select } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Progress } from '../../components/ui/Progress'
import { KrishiFarmMap, type MapMarkerItem } from '../../components/maps/KrishiFarmMap'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { CROP_NAMES, GROWTH_STAGES, SOIL_TYPES } from '../../data/crops'
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

const IRRIGATION_METHODS = ['Drip irrigation', 'Sprinkler', 'Flood / canal', 'Drip + canal', 'Rainfed']

export function MyFarm() {
  const { user } = useAuth()
  const { farms, createFarm, updateFarm, updateFarmPlots, backendConnected } = useApp()
  const activeFarm = farms[0]

  const mapBackendPlots = (): Plot[] =>
    (activeFarm?.plots ?? []).map((plot) => ({
      id: plot.id,
      name: plot.name,
      areaHa: plot.areaHa,
      crop: plot.crop,
      growthStage: plot.growthStage,
      soilMoisture: plot.soilMoisture ?? 35,
      lastIrrigated: plot.lastIrrigated ?? new Date().toISOString().slice(0, 10),
      status: plot.status ?? 'healthy',
      lat: plot.lat,
      lng: plot.lng,
    }))

  const [plots, setPlots] = useState<Plot[]>(mapBackendPlots)
  const [editing, setEditing] = useState<Plot | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [farmModalOpen, setFarmModalOpen] = useState(false)
  const [farmName, setFarmName] = useState('')
  const [farmLocation, setFarmLocation] = useState('')
  const [farmSoilType, setFarmSoilType] = useState(SOIL_TYPES[0])
  const [farmIrrigationType, setFarmIrrigationType] = useState(IRRIGATION_METHODS[0])
  const [farmCenterLat, setFarmCenterLat] = useState<number | undefined>(activeFarm?.centerLat)
  const [farmCenterLng, setFarmCenterLng] = useState<number | undefined>(activeFarm?.centerLng)
  const [pinTarget, setPinTarget] = useState<string>('farm')
  const [saving, setSaving] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    setFarmCenterLat(activeFarm?.centerLat)
    setFarmCenterLng(activeFarm?.centerLng)
  }, [activeFarm?.centerLat, activeFarm?.centerLng])

  useEffect(() => {
    setPlots(mapBackendPlots())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFarm?.id, activeFarm?.plots])

  const defaultFarmName = activeFarm?.name ?? (user?.name ? `${user.name.split(' ')[0]}'s Farm` : 'My Farm')
  const defaultLocation = activeFarm?.location ?? user?.location ?? 'India'
  const defaultSoil = activeFarm?.soilType ?? 'Not set'
  const defaultIrrigation = activeFarm?.irrigationType ?? 'Not set'

  const openFarmDetails = () => {
    setFarmName(activeFarm?.name ?? (user?.name ? `${user.name.split(' ')[0]}'s Farm` : ''))
    setFarmLocation(activeFarm?.location ?? user?.location ?? '')
    setFarmSoilType(activeFarm?.soilType ?? SOIL_TYPES[0])
    setFarmIrrigationType(activeFarm?.irrigationType ?? IRRIGATION_METHODS[0])
    setFarmModalOpen(true)
  }

  const saveFarmDetails = async (event: FormEvent) => {
    event.preventDefault()
    if (!farmName.trim() || !farmLocation.trim()) {
      show('Required fields', 'Enter a farm name and location.', 'warning')
      return
    }
    setSaving(true)
    try {
      if (activeFarm) {
        await updateFarm(activeFarm.id, {
          name: farmName.trim(),
          location: farmLocation.trim(),
          soilType: farmSoilType,
          irrigationType: farmIrrigationType,
          centerLat: farmCenterLat,
          centerLng: farmCenterLng,
        })
        show('Farm updated', `${farmName.trim()} saved to database.`, 'success')
      } else {
        await createFarm({
          name: farmName.trim(),
          location: farmLocation.trim(),
          areaHa: plots.reduce((sum, p) => sum + p.areaHa, 0),
          soilType: farmSoilType,
          irrigationType: farmIrrigationType,
          centerLat: farmCenterLat,
          centerLng: farmCenterLng,
          plots,
        })
        show('Farm created', `${farmName.trim()} saved to database.`, 'success')
      }
      setFarmModalOpen(false)
    } catch (err) {
      show('Unable to save farm', err instanceof Error ? err.message : 'Backend error.', 'critical')
    } finally {
      setSaving(false)
    }
  }

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
    if (!Number.isFinite(editing.areaHa) || editing.areaHa <= 0) {
      show('Invalid area', 'Plot area must be greater than 0 hectares.', 'warning')
      return
    }
    if (!Number.isFinite(editing.soilMoisture) || editing.soilMoisture < 0 || editing.soilMoisture > 100) {
      show('Invalid moisture', 'Soil moisture must be between 0% and 100%.', 'warning')
      return
    }
    const cleanPlot: Plot = { ...editing, name: editing.name.trim() }
    const exists = plots.some((plot) => plot.id === cleanPlot.id)
    const nextPlots = exists
      ? plots.map((plot) => (plot.id === cleanPlot.id ? cleanPlot : plot))
      : [cleanPlot, ...plots]
    setPlots(nextPlots)

    setSaving(true)
    try {
      if (activeFarm) {
        await updateFarmPlots(activeFarm.id, nextPlots)
      } else {
        await createFarm({
          name: defaultFarmName,
          location: defaultLocation,
          areaHa: Number(nextPlots.reduce((sum, p) => sum + p.areaHa, 0).toFixed(2)),
          soilType: SOIL_TYPES[0],
          irrigationType: IRRIGATION_METHODS[0],
          plots: nextPlots,
        })
      }
      show(exists ? 'Plot updated' : 'Plot added', `${cleanPlot.name} saved to your farm record.`, 'success')
      setModalOpen(false)
    } catch (err) {
      setPlots(mapBackendPlots())
      show(
        'Unable to save plot',
        err instanceof Error ? err.message : 'Unable to save farm update to database.',
        'critical',
      )
    } finally {
      setSaving(false)
    }
  }

  const removePlot = async (plotId: string) => {
    const prevPlots = plots
    const nextPlots = plots.filter((plot) => plot.id !== plotId)
    setPlots(nextPlots)
    if (!activeFarm) return
    try {
      await updateFarmPlots(activeFarm.id, nextPlots)
      show('Plot removed', 'Farm record updated.', 'info')
    } catch (err) {
      setPlots(prevPlots)
      show('Unable to remove plot', err instanceof Error ? err.message : 'Server error.', 'critical')
    }
  }

  const totalArea = plots.reduce((sum, plot) => sum + plot.areaHa, 0)

  const mapMarkers: MapMarkerItem[] = [
    ...(typeof farmCenterLat === 'number' && typeof farmCenterLng === 'number'
      ? [
          {
            id: 'farm-center',
            title: defaultFarmName,
            subtitle: `${defaultLocation} · ${totalArea.toFixed(1)} ha`,
            lat: farmCenterLat,
            lng: farmCenterLng,
            kind: 'farm' as const,
          },
        ]
      : []),
    ...plots
      .filter((p): p is Plot & { lat: number; lng: number } => typeof p.lat === 'number' && typeof p.lng === 'number')
      .map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: `${p.crop} · ${p.areaHa} ha · ${p.soilMoisture}% moisture`,
        lat: p.lat,
        lng: p.lng,
        kind: 'plot' as const,
      })),
  ]

  const handleMapSelect = async (coords: { lat: number; lng: number; label?: string }) => {
    const lat = Number(coords.lat.toFixed(6))
    const lng = Number(coords.lng.toFixed(6))
    if (pinTarget === 'farm') {
      setFarmCenterLat(lat)
      setFarmCenterLng(lng)
      try {
        if (activeFarm) {
          await updateFarm(activeFarm.id, { centerLat: lat, centerLng: lng })
        } else {
          await createFarm({
            name: defaultFarmName,
            location: coords.label ?? defaultLocation,
            areaHa: Number(totalArea.toFixed(2)),
            soilType: SOIL_TYPES[0],
            irrigationType: IRRIGATION_METHODS[0],
            centerLat: lat,
            centerLng: lng,
            plots,
          })
        }
        show('Farm pin saved', `Coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)} saved to your farm.`, 'success')
      } catch (err) {
        show('Could not save farm pin', err instanceof Error ? err.message : 'Database error.', 'critical')
      }
      return
    }

    const targetPlot = plots.find((p) => p.id === pinTarget)
    if (!targetPlot) return
    const nextPlots = plots.map((p) => (p.id === pinTarget ? { ...p, lat, lng } : p))
    setPlots(nextPlots)
    if (!activeFarm) return
    try {
      await updateFarmPlots(activeFarm.id, nextPlots)
      show('Plot pin saved', `${targetPlot.name} pinned at ${lat.toFixed(4)}, ${lng.toFixed(4)}.`, 'success')
    } catch (err) {
      show('Could not save plot pin', err instanceof Error ? err.message : 'Database error.', 'critical')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Farm records"
        title="My Farm"
        description="Register your farm details and plots; everything you save is persisted to your account."
        badge={<Badge tone={backendConnected && activeFarm ? 'forest' : 'sage'}>{activeFarm ? 'Saved farm record' : 'Empty — add farm or plot'}</Badge>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openFarmDetails}><Pencil size={15} /> {activeFarm ? 'Edit farm details' : 'Setup farm'}</Button>
            <Button onClick={openNew}><Plus size={16} /> Add plot</Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Farm name" value={activeFarm?.name ?? 'Not configured'} detail={defaultLocation} icon={<MapPin size={18} />} />
        <StatCard label="Total area" value={`${totalArea.toFixed(1)} ha`} detail={`${plots.length} plot${plots.length === 1 ? '' : 's'}`} icon={<Sprout size={18} />} tone="forest" />
        <StatCard label="Soil type" value={defaultSoil} detail={activeFarm ? 'Persisted record' : 'Set in farm setup'} icon={<Droplets size={18} />} />
        <StatCard label="Irrigation" value={defaultIrrigation} detail={activeFarm ? 'Active configuration' : 'Set in farm setup'} icon={<Droplets size={18} />} />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Farm & Plot Interactive Map"
          description="Search your village/district or click anywhere on the map to pin your farm center or individual plots."
          icon={<MapPin size={18} />}
          action={
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted">Click map to pin:</span>
              <select
                value={pinTarget}
                onChange={(e) => setPinTarget(e.target.value)}
                className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink"
                aria-label="Select pin target"
              >
                <option value="farm">Farm Center</option>
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    Plot: {p.name}
                  </option>
                ))}
              </select>
            </div>
          }
        />
        <KrishiFarmMap
          markers={mapMarkers}
          selectionEnabled
          enablePlaceSearch
          searchPlaceholder="Search village, taluka, or district in India…"
          onSelectCoordinates={(coords) => void handleMapSelect(coords)}
        />
        <p className="mt-3 text-[11px] text-muted">
          {typeof farmCenterLat === 'number' && typeof farmCenterLng === 'number'
            ? `Saved farm coordinates: ${farmCenterLat.toFixed(5)}, ${farmCenterLng.toFixed(5)}. Click a pin for details.`
            : 'No farm coordinates pinned yet. Search your area or click the map to save your farm location.'}
        </p>
      </Card>

      {plots.length > 0 ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {plots.map((plot) => (
            <Card key={plot.id} className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge tone="sage">Plot</Badge>
                  <h2 className="mt-3 text-lg font-extrabold tracking-tight text-ink">{plot.name}</h2>
                  <p className="mt-1 text-xs text-muted">{plot.crop} · {plot.areaHa} ha · {plot.growthStage}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => openEdit(plot)} className="flex size-9 items-center justify-center rounded-xl bg-soft-sage text-forest hover:bg-sage/40" aria-label={`Edit ${plot.name}`}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" onClick={() => void removePlot(plot.id)} className="flex size-9 items-center justify-center rounded-xl text-muted hover:bg-[#FBE7E3] hover:text-alert" aria-label={`Delete ${plot.name}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-soft-sage/45 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-extrabold tracking-wide text-muted uppercase">Soil moisture</p>
                    <StatusPill status={plot.status} />
                  </div>
                  <p className="mt-2 text-2xl font-extrabold text-ink">{plot.soilMoisture}%</p>
                  <div className="mt-3"><Progress value={plot.soilMoisture} /></div>
                  <p className="mt-2 text-[10px] text-muted">Saved plot reading</p>
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
      ) : (
        <Card className="mt-6 py-12 text-center">
          <Sprout size={30} className="mx-auto text-forest" />
          <p className="mt-3 text-base font-extrabold text-ink">No plots saved yet</p>
          <p className="mt-1 text-xs text-muted">Add your first farm plot to start tracking crops, moisture, and irrigation.</p>
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="outline" onClick={openFarmDetails}>Setup farm details</Button>
            <Button onClick={openNew}><Plus size={15} /> Add first plot</Button>
          </div>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader title="Farm context" description="Information used by the irrigation recommendation engine." icon={<MapPin size={18} />} />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Location', value: activeFarm?.location ?? 'Not configured' },
            { label: 'Soil type', value: defaultSoil },
            { label: 'Irrigation method', value: defaultIrrigation },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-soft-sage/40 p-4">
              <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">{item.label}</p>
              <p className="mt-2 text-sm font-bold text-ink">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={farmModalOpen}
        onClose={() => setFarmModalOpen(false)}
        title={activeFarm ? 'Edit farm details' : 'Setup your farm'}
        description="Save your farm name, location, soil type, and irrigation method."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFarmModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="farm-meta-form" disabled={saving}>{saving ? 'Saving…' : 'Save farm'}</Button>
          </>
        }
      >
        <form id="farm-meta-form" onSubmit={(e) => void saveFarmDetails(e)} className="space-y-4">
          <Field label="Farm name" required>
            <Input value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="e.g. Green Valley Farm" />
          </Field>
          <Field label="Location" required>
            <Input value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} placeholder="District, State" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Soil type">
              <Select value={farmSoilType} onChange={(e) => setFarmSoilType(e.target.value)} options={SOIL_TYPES.map((s) => ({ value: s, label: s }))} />
            </Field>
            <Field label="Irrigation method">
              <Select value={farmIrrigationType} onChange={(e) => setFarmIrrigationType(e.target.value)} options={IRRIGATION_METHODS.map((m) => ({ value: m, label: m }))} />
            </Field>
          </div>
        </form>
      </Modal>

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
              <Input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder="e.g. Plot A — North Field" />
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
