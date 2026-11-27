import { useMemo, useState } from 'react'
import { BellRing, Database, Plus, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Field, Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { DemoNote } from '../../components/common/DemoNote'
import { useToast } from '../../context/ToastContext'
import { formatDate, formatINR } from '../../services/utils'
import { useApp } from '../../services/store'
import { AdminCollectionPage, type AdminFilter } from './AdminCollectionPage'
import type { Column } from '../../components/ui/Table'
import type { MandiPrice } from '../../types'

export function MandiDataManagementPage() {
  const { mandiPrices, mandiAlerts, addMandiAlert, removeMandiAlert, addMandiPrice } = useApp()
  const { show } = useToast()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [crop, setCrop] = useState('Tomato')
  const [district, setDistrict] = useState('Nashik')
  const [target, setTarget] = useState('1900')
  const [error, setError] = useState('')
  const [newPrice, setNewPrice] = useState({
    crop: 'Tomato',
    state: 'Maharashtra',
    district: 'Nashik',
    mandi: 'Nashik APMC',
    minPrice: 1500,
    modalPrice: 1920,
    maxPrice: 2300,
    date: new Date().toISOString().slice(0, 10),
  })

  const cropFilter: AdminFilter<MandiPrice> = useMemo(
    () => ({ label: 'Crop', options: [...new Set(mandiPrices.map((row) => row.crop))], value: (row) => row.crop }),
    [mandiPrices],
  )
  const stateFilter: AdminFilter<MandiPrice> = useMemo(
    () => ({ label: 'State', options: [...new Set(mandiPrices.map((row) => row.state))], value: (row) => row.state }),
    [mandiPrices],
  )

  const columns: Column<MandiPrice>[] = [
    { key: 'crop', label: 'Crop', render: (row) => <p className="font-bold text-ink">{row.crop}</p> },
    { key: 'mandi', label: 'Mandi', render: (row) => <div><p className="font-semibold text-ink">{row.mandi}</p><p className="text-xs text-muted">{row.district}, {row.state}</p></div> },
    { key: 'modal', label: 'Modal price', render: (row) => <p className="font-bold text-ink">{formatINR(row.modalPrice)}</p> },
    { key: 'range', label: 'Range', render: (row) => <p className="text-sm text-muted">{formatINR(row.minPrice)} – {formatINR(row.maxPrice)}</p> },
    {
      key: 'change',
      label: 'Change',
      render: (row) => (
        <Badge tone={row.changePct >= 0 ? 'success' : 'critical'} icon={row.changePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}>
          {row.changePct >= 0 ? '+' : ''}{row.changePct}%
        </Badge>
      ),
    },
    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
  ]

  const createAlert = async (alertCrop: string, alertDistrict: string, alertTarget: string) => {
    const parsed = Number(alertTarget)
    if (alertCrop.trim().length < 2 || alertDistrict.trim().length < 2 || !Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a crop, district and a positive target price.')
      return false
    }
    try {
      await addMandiAlert({ crop: alertCrop.trim(), district: alertDistrict.trim(), targetPrice: parsed })
      show('Price alert created', `${alertCrop.trim()} in ${alertDistrict.trim()} at ${formatINR(parsed)} saved to database.`)
      setError('')
      return true
    } catch (err) {
      show('Unable to create alert', err instanceof Error ? err.message : 'Backend error.', 'critical')
      return false
    }
  }

  const submitNewPrice = async () => {
    try {
      await addMandiPrice({
        ...newPrice,
        source: 'Admin portal entry (sample)',
        dataType: 'sample',
        changePct: 1.5,
      })
      setAddOpen(false)
      show('Mandi price saved', `${newPrice.crop} at ${newPrice.mandi} added via backend API.`, 'success')
    } catch (err) {
      show('Invalid price entry', err instanceof Error ? err.message : 'Unable to save mandi price.', 'critical')
    }
  }

  return (
    <>
      <AdminCollectionPage
        eyebrow="Market data"
        title="Mandi data"
        description="Inspect the demonstration price dataset and manage local price alerts. These are not live market rates."
        rows={mandiPrices}
        columns={columns}
        searchable={(row) => [row.crop, row.mandi, row.district, row.state, row.source]}
        filters={[cropFilter, stateFilter]}
        stats={[
          { label: 'Price records', value: mandiPrices.length, detail: 'Loaded from backend API', icon: <Database size={18} />, tone: 'sage' },
          { label: 'Crops tracked', value: new Set(mandiPrices.map((row) => row.crop)).size, detail: 'Across sample mandis', icon: <TrendingUp size={18} />, tone: 'forest' },
          { label: 'Price alerts', value: mandiAlerts.length, detail: 'Created in this session', icon: <BellRing size={18} />, tone: 'neutral' },
          { label: 'Data source', value: 'API', detail: 'Sample dataset in backend', icon: <Database size={18} />, tone: 'alert' },
        ]}
        detailTitle={(row) => `${row.crop} · ${row.mandi}`}
        detailContent={(row) => (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Location</p><p className="font-semibold text-ink">{row.district}, {row.state}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Record date</p><p className="font-semibold text-ink">{formatDate(row.date)}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Minimum</p><p className="font-semibold text-ink">{formatINR(row.minPrice)}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Maximum</p><p className="font-semibold text-ink">{formatINR(row.maxPrice)}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Modal price</p><p className="font-semibold text-ink">{formatINR(row.modalPrice)}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Change</p><p className="font-semibold text-ink">{row.changePct}%</p></div>
            </div>
            <DemoNote label="Simulated market data" />
            <p className="text-xs leading-relaxed text-muted">Source label: {row.source}. Do not use these values for selling decisions.</p>
          </div>
        )}
        confirm={{
          label: 'Create alert',
          description: (row) => `Create a price alert for ${row.crop} in ${row.district} at the modal price of ${formatINR(row.modalPrice)}?`,
          onConfirm: (row) => {
            void createAlert(row.crop, row.district, String(row.modalPrice))
          },
        }}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Add price</Button>
            <Button size="sm" variant="outline" onClick={() => setAlertsOpen(true)}><BellRing size={14} /> Manage alerts ({mandiAlerts.length})</Button>
          </div>
        }
      />

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add mandi price record"
        description="Submit a new sample price entry to POST /api/mandi/prices."
        footer={<><Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={() => void submitNewPrice()}>Save entry</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Crop" required><Input value={newPrice.crop} onChange={(e) => setNewPrice({ ...newPrice, crop: e.target.value })} /></Field>
          <Field label="Mandi" required><Input value={newPrice.mandi} onChange={(e) => setNewPrice({ ...newPrice, mandi: e.target.value })} /></Field>
          <Field label="District" required><Input value={newPrice.district} onChange={(e) => setNewPrice({ ...newPrice, district: e.target.value })} /></Field>
          <Field label="State" required><Input value={newPrice.state} onChange={(e) => setNewPrice({ ...newPrice, state: e.target.value })} /></Field>
          <Field label="Min price (₹)" required><Input type="number" min="0" value={newPrice.minPrice} onChange={(e) => setNewPrice({ ...newPrice, minPrice: Number(e.target.value) })} /></Field>
          <Field label="Modal price (₹)" required><Input type="number" min="0" value={newPrice.modalPrice} onChange={(e) => setNewPrice({ ...newPrice, modalPrice: Number(e.target.value) })} /></Field>
          <Field label="Max price (₹)" required><Input type="number" min="0" value={newPrice.maxPrice} onChange={(e) => setNewPrice({ ...newPrice, maxPrice: Number(e.target.value) })} /></Field>
          <Field label="Date" required><Input type="date" value={newPrice.date} onChange={(e) => setNewPrice({ ...newPrice, date: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={alertsOpen}
        onClose={() => { setAlertsOpen(false); setError('') }}
        title="Price alerts"
        description="Create or remove demo-only price alerts. No notifications are sent externally."
        footer={<Button variant="ghost" onClick={() => setAlertsOpen(false)}>Close</Button>}
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Crop" required><Input value={crop} onChange={(event) => setCrop(event.target.value)} /></Field>
            <Field label="District" required><Input value={district} onChange={(event) => setDistrict(event.target.value)} /></Field>
            <Field label="Target (₹/quintal)" required error={error}><Input type="number" min="1" value={target} onChange={(event) => setTarget(event.target.value)} /></Field>
          </div>
          <Button onClick={() => void createAlert(crop, district, target)}>Add alert</Button>
          <div className="space-y-2">
            {mandiAlerts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line bg-white/50 px-4 py-6 text-center text-sm text-muted">No alerts created yet.</p>
            ) : mandiAlerts.map((alert) => (
              <div key={alert.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/80 bg-white/70 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-ink">{alert.crop} · {alert.district}</p>
                  <p className="text-xs text-muted">Target {formatINR(alert.targetPrice)} · {formatDate(alert.createdAt)}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void removeMandiAlert(alert.id)
                      .then(() => show('Alert removed', `${alert.crop} alert deleted from database.`))
                      .catch((err) => show('Unable to remove alert', err instanceof Error ? err.message : 'Backend error.', 'critical'))
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  )
}
