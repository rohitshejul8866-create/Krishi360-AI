import { useMemo, useState } from 'react'
import { CalendarRange, Droplets, Info, Leaf, Plus, Sprout, Trash2 } from 'lucide-react'
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
import { useApp } from '../../services/store'
import type { Crop } from '../../types'

export function MyCrops() {
  const { farms, customCrops, addCustomCrop, removeCustomCrop } = useApp()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const [selected, setSelected] = useState<Crop | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const { show } = useToast()

  const userPlots = useMemo(() => farms.flatMap((farm) => farm.plots), [farms])

  const activeCatalog = useMemo(() => {
    const names = Array.from(new Set([...userPlots.map((plot) => plot.crop), ...customCrops]))
    return names.map<Crop>((name) => {
      const known = CROPS.find((item) => item.name.toLowerCase() === name.toLowerCase())
      if (known) return known
      return {
        id: `crop-custom-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        category: 'Other',
        season: 'Not specified',
        durationDays: 0,
        waterNeed: 'medium',
        icon: 'sprout',
      }
    })
  }, [userPlots, customCrops])

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

  const addCrop = async () => {
    const trimmed = newName.trim()
    if (!trimmed) {
      show('Crop name required', 'Enter a crop name to save it.', 'warning')
      return
    }
    if (activeCatalog.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) {
      show('Already in list', `${trimmed} is already in your crop list.`, 'info')
      return
    }
    setSaving(true)
    try {
      await addCustomCrop(trimmed)
      setNewName('')
      setAddOpen(false)
      show('Crop saved', `${trimmed} saved to your workspace database.`, 'success')
    } catch (err) {
      show('Unable to save crop', err instanceof Error ? err.message : 'Backend error.', 'critical')
    } finally {
      setSaving(false)
    }
  }

  const deleteCrop = async (cropName: string) => {
    try {
      await removeCustomCrop(cropName)
      show('Crop removed', `${cropName} removed from your saved list.`, 'info')
    } catch (err) {
      show('Unable to remove crop', err instanceof Error ? err.message : 'Backend error.', 'critical')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Crop records"
        title="My Crops"
        description="Crops linked to your farm plots and custom crops saved in your workspace."
        badge={<DemoNote label="Saved crops" />}
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
          const plot = userPlots.find((item) => item.crop === crop.name)
          const isCustomOnly = customCrops.some((c) => c.toLowerCase() === crop.name.toLowerCase()) && !plot
          return (
            <Card key={crop.id} interactive className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-soft-sage text-forest"><Sprout size={22} /></span>
                <div className="flex items-center gap-2">
                  <Badge tone="sage">{crop.category}</Badge>
                  {isCustomOnly ? (
                    <button
                      type="button"
                      onClick={() => void deleteCrop(crop.name)}
                      className="flex size-8 items-center justify-center rounded-xl text-muted hover:bg-[#FBE7E3] hover:text-alert"
                      aria-label={`Remove ${crop.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
              <h2 className="mt-5 text-xl font-extrabold tracking-tight text-ink">{crop.name}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                {plot ? `Growing in ${plot.name} · ${plot.areaHa} ha · ${plot.growthStage}.` : 'Saved to your crop list. Link it to a plot from My Farm.'}
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
        <Card className="mt-5 py-12 text-center">
          <Leaf size={28} className="mx-auto text-forest" />
          <p className="mt-3 text-sm font-bold text-ink">
            {activeCatalog.length === 0 ? 'No crops added yet.' : 'No crops match these filters.'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {activeCatalog.length === 0
              ? 'Add a crop here or register a plot in My Farm.'
              : 'Try a different category or clear the search.'}
          </p>
        </Card>
      ) : null}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected?.name ?? 'Crop details'} description="Crop advisory context.">
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
              Advisory outputs in CropDoctor AI and JalSense use the crop name as context only.
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a crop" description="Save a crop to your workspace list.">
        <Field label="Crop name" required>
          <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Soybean" />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button onClick={() => void addCrop()} disabled={saving}>{saving ? 'Saving…' : 'Save crop'}</Button>
        </div>
      </Modal>
    </div>
  )
}
