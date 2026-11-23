import { useMemo, useState } from 'react'
import { BellPlus, Calculator, IndianRupee, MapPin, Store, Trash2, TrendingUp } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { FilterBar } from '../../components/common/FilterBar'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { DataTable } from '../../components/ui/Table'
import type { Column } from '../../components/ui/Table'
import { TrendChart } from '../../components/charts/TrendChart'
import { StatCard } from '../../components/common/StatCard'
import { useApp } from '../../services/store'
import { useToast } from '../../context/ToastContext'
import { mandiService } from '../../services/mandiService'
import { formatDate, formatINR } from '../../services/utils'
import { CROP_NAMES } from '../../data/crops'
import type { MandiPrice } from '../../types'

export function MandiSmartPage() {
  const { mandiPrices, mandiAlerts, addMandiAlert, removeMandiAlert } = useApp()
  const { show } = useToast()
  const [crop, setCrop] = useState('Tomato')
  const [state, setState] = useState('All states')
  const [district, setDistrict] = useState('All districts')
  const [query, setQuery] = useState('')
  const [quantity, setQuantity] = useState(20)
  const [transport, setTransport] = useState(3500)
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertCrop, setAlertCrop] = useState('Tomato')
  const [alertDistrict, setAlertDistrict] = useState('Nashik')
  const [targetPrice, setTargetPrice] = useState(1900)

  const stateOptions = useMemo(() => Array.from(new Set(mandiPrices.map((row) => row.state))).sort(), [mandiPrices])
  const districtOptions = useMemo(() => Array.from(new Set(mandiPrices.map((row) => row.district))).sort(), [mandiPrices])

  const rows = useMemo(
    () => mandiService.filter(mandiPrices, { crop, state, district, query }),
    [mandiPrices, crop, state, district, query],
  )
  const summary = useMemo(() => mandiService.summary(rows), [rows])
  const trend = useMemo(() => mandiService.trend(crop), [crop])
  const estimate = mandiService.estimate(quantity, summary.modal, transport)

  const columns: Column<MandiPrice>[] = [
    { key: 'mandi', label: 'Mandi', render: (row) => <div><p className="font-bold text-ink">{row.mandi}</p><p className="text-[11px] text-muted">{row.district}, {row.state}</p></div> },
    { key: 'min', label: 'Min', render: (row) => formatINR(row.minPrice) },
    { key: 'max', label: 'Max', render: (row) => formatINR(row.maxPrice) },
    { key: 'modal', label: 'Modal', render: (row) => <span className="font-extrabold text-forest">{formatINR(row.modalPrice)}</span> },
    { key: 'change', label: 'Change', render: (row) => <Badge tone={row.changePct >= 0 ? 'success' : 'critical'}>{row.changePct >= 0 ? '+' : ''}{row.changePct}%</Badge> },
    { key: 'date', label: 'Date', render: (row) => <span className="text-xs text-muted">{formatDate(row.date)}</span> },
  ]

  const createAlert = () => {
    if (targetPrice <= 0) return show('Invalid target', 'Enter a positive target price.', 'warning')
    addMandiAlert({ crop: alertCrop, district: alertDistrict, targetPrice })
    setAlertOpen(false)
    show('Price alert created', `Demo alert for ${alertCrop} in ${alertDistrict}.`, 'success')
  }

  const reset = () => {
    setCrop('Tomato')
    setState('All states')
    setDistrict('All districts')
    setQuery('')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Module 02 · Market intelligence"
        title="MandiSmart"
        description="Compare sample mandi prices, review trends and estimate potential returns. Nothing here is a live market quote."
        badge={<DemoNote label="Demo price dataset" />}
        actions={<Button variant="outline" onClick={() => setAlertOpen(true)}><BellPlus size={15} /> Create price alert</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Mandis compared" value={summary.mandiCount} detail="Matching current filters" icon={<Store size={18} />} />
        <StatCard label="Lowest minimum" value={formatINR(summary.min)} detail="Sample minimum price" icon={<IndianRupee size={18} />} />
        <StatCard label="Highest maximum" value={formatINR(summary.max)} detail="Sample maximum price" icon={<TrendingUp size={18} />} />
        <StatCard label="Average modal" value={formatINR(summary.modal)} detail="Used in revenue estimate" icon={<Calculator size={18} />} tone="forest" />
      </div>

      <div className="mt-6">
        <FilterBar
          search={query}
          onSearch={setQuery}
          placeholder="Search mandi, district or state…"
          selects={[
            { label: 'Crop', value: crop, onChange: setCrop, options: [{ value: 'All crops', label: 'All crops' }, ...CROP_NAMES.map((name) => ({ value: name, label: name }))] },
            { label: 'State', value: state, onChange: setState, options: [{ value: 'All states', label: 'All states' }, ...stateOptions.map((name) => ({ value: name, label: name }))] },
            { label: 'District', value: district, onChange: setDistrict, options: [{ value: 'All districts', label: 'All districts' }, ...districtOptions.map((name) => ({ value: name, label: name }))] },
          ]}
          onReset={reset}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader title="Mandi comparison" description="Prices are illustrative sample values per quintal." icon={<Store size={18} />} action={<DemoNote label="Not live" />} />
          <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} compact={false} />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Price trend" description={`Sample modal trend for ${crop}.`} icon={<TrendingUp size={18} />} />
            <TrendChart data={trend} xKey="day" yKey="price" name="Modal price (₹/qtl)" height={230} />
          </Card>

          <Card>
            <CardHeader title="Revenue estimator" description="Simple demo calculation using average modal price." icon={<Calculator size={18} />} />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity (qtl)">
                  <Input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
                </Field>
                <Field label="Transport (₹)">
                  <Input type="number" min="0" value={transport} onChange={(event) => setTransport(Number(event.target.value))} />
                </Field>
              </div>
              <div className="rounded-2xl bg-soft-sage/50 p-4">
                <div className="flex items-center justify-between text-xs text-muted"><span>Gross estimate</span><span className="font-bold text-ink">{formatINR(estimate.gross)}</span></div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted"><span>Transport cost</span><span className="font-bold text-ink">− {formatINR(estimate.transportCost)}</span></div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3"><span className="text-xs font-bold text-muted">Net estimate</span><span className="text-xl font-extrabold text-forest">{estimate.formattedNet}</span></div>
              </div>
              <p className="text-[10px] leading-relaxed text-muted">Estimate only. Does not include commissions, quality differences, taxes or actual transport rates.</p>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Price alerts" description="Demo notifications you create from this screen." icon={<BellPlus size={18} />} />
        <div className="space-y-2">
          {mandiAlerts.map((alert) => (
            <div key={alert.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/70 bg-white/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-soft-sage text-forest"><MapPin size={16} /></span>
                <div>
                  <p className="text-sm font-bold text-ink">{alert.crop} · {alert.district}</p>
                  <p className="text-[11px] text-muted">Target {formatINR(alert.targetPrice)} · created {formatDate(alert.createdAt)}</p>
                </div>
              </div>
              <button type="button" onClick={() => { removeMandiAlert(alert.id); show('Alert removed', 'Demo price alert deleted.', 'info') }} className="flex size-9 items-center justify-center rounded-xl text-muted hover:bg-[#FBE7E3] hover:text-alert" aria-label="Remove alert"><Trash2 size={15} /></button>
            </div>
          ))}
          {mandiAlerts.length === 0 ? <p className="py-8 text-center text-sm text-muted">No price alerts yet.</p> : null}
        </div>
      </Card>

      <Modal open={alertOpen} onClose={() => setAlertOpen(false)} title="Create a price alert" description="This alert is simulated and never contacts a market feed.">
        <div className="space-y-4">
          <Field label="Crop">
            <Select value={alertCrop} onChange={(event) => setAlertCrop(event.target.value)} options={CROP_NAMES.map((name) => ({ value: name, label: name }))} />
          </Field>
          <Field label="District">
            <Select value={alertDistrict} onChange={(event) => setAlertDistrict(event.target.value)} options={districtOptions.map((name) => ({ value: name, label: name }))} />
          </Field>
          <Field label="Target modal price (₹/qtl)">
            <Input type="number" min="1" value={targetPrice} onChange={(event) => setTargetPrice(Number(event.target.value))} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAlertOpen(false)}>Cancel</Button>
            <Button onClick={createAlert}>Create alert</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
