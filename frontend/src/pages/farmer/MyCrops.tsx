import { useMemo, useState } from 'react'
import { CalendarRange, Droplets, Info, Leaf, Plus, Sprout } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { FilterBar } from '../../components/common/FilterBar'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Input'
import { useToast } from '../../context/ToastContext'
import { CROPS } from '../../data/crops'
import { DEMO_FARM } from '../../data/farmers'
import type { Crop } from '../../types'

export function MyCrops() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const [selected, setSelected] = useState<Crop | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [customCrops, setCustomCrops] = useState<Crop[]>([])
  const [newName, setNewName] = useState('')
  const { show } = useToast()

  const crops = useMemo(() => [...DEMO_FARM.plots.map((plot) => plot.crop), ...customCrops.map((crop) => crop.name)], [customCrops])
  const activeCatalog = useMemo(() => {
    const catalog = [...CROPS, ...customCrops]
    return catalog.filter((crop) => crops.includes(crop.name))
  }, [customCrops, crops])

  const filtered = useMemo(() => {
    return activeCatalog.filter((crop) => {
      const matchesCategory = category === 'All categories' || crop.category === category
      const matchesQuery = !query.trim() || crop.name.toLowerCase().includes(query.trim().toLowerCase())
      return matchesCategory && matchesQuery
    })
  }, [activeCatalog, category, query])

  const categories = useMemo(
    () => ['All categories', ...Array.from(new Set(activeCatalog.map((crop) => crop.category)))],
    [activeCatalog],
  )

  const addCrop = () => {
    const trimmed = newName.trim()
    if (!trimmed) return show('Crop name required', 'Enter a crop name to add it to the demo list.', 'warning')
    if (activeCatalog.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) {
      return show('Already in list', `${trimmed} is already in your crop list.`, 'info')
    }
    const crop: Crop = {
      id: `crop-custom-${Date.now()}`,
      name: trimmed,
      category: 'Other',
      season: 'Not specified',
      durationDays: 0,
      waterNeed: 'medium',
      icon: 'sprout',
    }
    setCustomCrops((current) => [crop, ...current])
    setNewName('')
    setAddOpen(false)
    show('Crop added', `${crop.name} is now in your demo crop list.`, 'success')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Crop records"
        title="My Crops"
        description="Crops currently linked to your plots, with quick access to demo advisory context."
        badge={<DemoNote label="Sample catalog" />}
        actions={<Button onClick={() => setAddOpen(true)}><Plus size={16} /> Add crop</Button>}
      />

      <FilterBar
        search={query}
        onSearch={setQuery}
        placeholder="Search your crops…"
        selects={[{ label: 'Category', value: category, onChange: setCategory, options: categories.map((item) => ({ value: item, label: item })) }]}
        onReset={() => { setQuery(''); setCategory('All categories') }}
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((crop) => {
          const plot = DEMO_FARM.plots.find((item) => item.crop === crop.name)
          return (
            <Card key={crop.id} interactive className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-soft-sage text-forest"><Sprout size={22} /></span>
                <Badge tone="sage">{crop.category}</Badge>
              </div>
              <h2 className="mt-5 text-xl font-extrabold tracking-tight text-ink">{crop.name}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                {plot ? `Growing in ${plot.name} · ${plot.areaHa} ha · ${plot.growthStage}.` : 'Added to your demo crop list. Link it to a plot from My Farm.'}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl bg-soft-sage/45 p-3">
                  <Droplets size={15} className="text-forest" />
                  <p className="mt-2 font-bold text-ink">{crop.waterNeed} water need</p>
                </div>
                <div className="rounded-2xl bg-soft-sage/45 p-3">
                  <CalendarRange size={15} className="text-forest" />
                  <p className="mt-2 font-bold text-ink">{crop.durationDays || '—'} days</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(crop)} className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-forest hover:underline">
                <Info size={14} /> View crop details
              </button>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="mt-5 text-center">
          <Leaf size={28} className="mx-auto text-forest" />
          <p className="mt-3 text-sm font-bold text-ink">No crops match these filters.</p>
          <p className="mt-1 text-xs text-muted">Try a different category or clear the search.</p>
        </Card>
      ) : null}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected?.name ?? 'Crop details'} description="Sample crop catalogue information.">
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Category', value: selected.category },
                { label: 'Season', value: selected.season },
                { label: 'Duration', value: selected.durationDays ? `${selected.durationDays} days` : 'Not specified' },
                { label: 'Water need', value: selected.waterNeed },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-soft-sage/45 p-4">
                  <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">{item.label}</p>
                  <p className="mt-1.5 text-sm font-bold text-ink capitalize">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-line/70 p-4 text-xs leading-relaxed text-muted">
              This catalogue entry is demo data. Advisory outputs in CropDoctor AI and JalSense use the crop name as context only.
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a demo crop" description="Add a crop name to your session-only list.">
        <Field label="Crop name" required>
          <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Soybean" />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button onClick={addCrop}>Add crop</Button>
        </div>
      </Modal>
    </div>
  )
}
