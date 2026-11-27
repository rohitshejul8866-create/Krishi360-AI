import { useMemo, useState } from 'react'
import { RefreshCw, Sprout, UserRoundCheck, Users } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StatusPill } from '../../components/ui/Badge'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../services/store'
import { formatDate, formatNumber } from '../../services/utils'
import { AdminCollectionPage, type AdminFilter } from './AdminCollectionPage'
import { AdminAddUserModal } from './AdminAddUserModal'
import type { Column } from '../../components/ui/Table'

type AdminUser = ReturnType<typeof useApp>['users'][number]

export function FarmerManagementPage() {
  const { user, authProvider } = useAuth()
  const { users, farms, cases, storageBatches, updateUserStatus, syncBackendData } = useApp()
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const farmers = useMemo(() => users.filter((u) => u.role === 'farmer'), [users])
  const locationFilter: AdminFilter<AdminUser> = {
    label: 'Location',
    options: [...new Set(farmers.map((farmer) => farmer.location.split(',')[0].trim()).filter(Boolean))],
    value: (row) => row.location.split(',')[0].trim(),
  }
  const statusFilter: AdminFilter<AdminUser> = { label: 'Status', options: ['active', 'invited', 'suspended'], value: (row) => row.status }

  const handleRefresh = async () => {
    if (!user || !authProvider) return
    setRefreshing(true)
    try {
      await syncBackendData({ id: user.id, role: user.role, name: user.name, provider: authProvider })
    } finally {
      setRefreshing(false)
    }
  }

  const columns: Column<AdminUser>[] = [
    { key: 'name', label: 'Farmer', render: (row) => <div><p className="font-bold text-ink">{row.name}</p><p className="text-xs text-muted">{row.email}</p></div> },
    { key: 'location', label: 'Location', render: (row) => row.location || 'India' },
    {
      key: 'activity',
      label: 'Saved data',
      render: (row) => {
        const fCount = farms.filter((f) => f.farmerId === row.id).length
        const cCount = cases.filter((c) => c.farmerId === row.id).length
        const bCount = storageBatches.filter((b) => b.ownerId === row.id).length
        return (
          <span className="text-xs font-semibold text-ink">
            {fCount} farms · {cCount} cases · {bCount} batches
          </span>
        )
      },
    },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
  ]
  return (
    <>
      <AdminCollectionPage
        eyebrow="Farmer network"
        title="Farmer management"
        description="Manage registered farmer accounts, newly signed-in growers, and their farm, case, and storage records."
        rows={farmers}
        columns={columns}
        searchable={(row) => [row.name, row.email, row.location, row.phone]}
        filters={[locationFilter, statusFilter]}
        stats={[
          { label: 'Farmers', value: farmers.length, detail: 'Registered growers', icon: <Users size={18} />, tone: 'sage' },
          { label: 'Active', value: farmers.filter((farmer) => farmer.status === 'active').length, detail: 'Ready to use portals', icon: <UserRoundCheck size={18} />, tone: 'forest' },
          { label: 'Farms', value: farms.length, detail: 'Synced grower farms', icon: <Sprout size={18} />, tone: 'neutral' },
          { label: 'Invited', value: farmers.filter((farmer) => farmer.status === 'invited').length, detail: 'Pending activation', icon: <Sprout size={18} />, tone: 'alert' },
        ]}
        detailContent={(row) => {
          const farmerFarms = farms.filter((f) => f.farmerId === row.id)
          const farmerCases = cases.filter((c) => c.farmerId === row.id)
          const farmerBatches = storageBatches.filter((b) => b.ownerId === row.id)
          return (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Farmer</p><p className="font-semibold text-ink">{row.name}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Email</p><p className="font-semibold text-ink">{row.email}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Location</p><p className="font-semibold text-ink">{row.location || 'India'}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Phone</p><p className="font-semibold text-ink">{row.phone || 'Not provided'}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Status</p><StatusPill status={row.status} /></div>
                <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Joined</p><p className="font-semibold text-ink">{formatDate(row.joinedAt)}</p></div>
              </div>

              <div className="border-t border-line pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Registered farms ({farmerFarms.length})</p>
                {farmerFarms.length === 0 ? (
                  <p className="mt-1.5 text-sm text-muted">No farms saved yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {farmerFarms.map((farm) => (
                      <div key={farm.id} className="rounded-2xl border border-line/80 bg-white/70 px-4 py-3 text-sm">
                        <p className="font-bold text-ink">{farm.name}</p>
                        <p className="text-xs text-muted">{farm.location} · {farm.areaHa} ha · {farm.plots.length} plots · {farm.soilType}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-line pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Crop diagnosis cases ({farmerCases.length})</p>
                {farmerCases.length === 0 ? (
                  <p className="mt-1.5 text-sm text-muted">No crop cases submitted yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {farmerCases.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-white/70 px-4 py-3 text-sm">
                        <div>
                          <p className="font-bold text-ink">{c.crop} · {c.condition}</p>
                          <p className="text-xs text-muted">{c.id} · {formatDate(c.submittedAt)}</p>
                        </div>
                        <StatusPill status={c.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-line pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Storage batches ({farmerBatches.length})</p>
                {farmerBatches.length === 0 ? (
                  <p className="mt-1.5 text-sm text-muted">No storage batches logged yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {farmerBatches.map((batch) => (
                      <div key={batch.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-white/70 px-4 py-3 text-sm">
                        <div>
                          <p className="font-bold text-ink">{batch.code} · {batch.crop}</p>
                          <p className="text-xs text-muted">{formatNumber(batch.quantityKg)} kg · {batch.tempC}°C / {batch.humidity}% RH</p>
                        </div>
                        <StatusPill status={batch.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        }}
        confirm={{
          label: 'Toggle status',
          description: (row) => `${row.status === 'active' ? 'Suspend' : 'Activate'} ${row.name} in the backend user directory?`,
          onConfirm: (row) => updateUserStatus(row.id, row.status === 'active' ? 'suspended' : 'active'),
        }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setAdding(true)}>Add farmer</Button>
          </div>
        }
      />
      <AdminAddUserModal role="farmer" open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
