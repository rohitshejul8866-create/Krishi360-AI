import { useState } from 'react'
import { RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { StatusPill } from '../../components/ui/Badge'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../services/store'
import { formatDate, formatNumber } from '../../services/utils'
import { AdminCollectionPage, type AdminFilter } from './AdminCollectionPage'
import type { Column } from '../../components/ui/Table'

type AdminUser = ReturnType<typeof useApp>['users'][number]

const roleFilter: AdminFilter<AdminUser> = { label: 'Role', options: ['farmer', 'expert', 'admin'], value: (row) => row.role }
const statusFilter: AdminFilter<AdminUser> = { label: 'Status', options: ['active', 'invited', 'suspended'], value: (row) => row.status }
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

export function UserManagementPage() {
  const { user, authProvider } = useAuth()
  const { users, farms, cases, storageBatches, updateUserStatus, syncBackendData } = useApp()
  const navigate = useNavigate()
  const [refreshing, setRefreshing] = useState(false)

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
    { key: 'name', label: 'User', render: (row) => <div><p className="font-bold text-ink">{row.name}</p><p className="text-xs text-muted">{row.email}</p></div> },
    { key: 'role', label: 'Role', render: (row) => <span className="text-sm capitalize text-ink">{row.role}</span> },
    { key: 'location', label: 'Location', render: (row) => row.location || '—' },
    {
      key: 'records',
      label: 'Activity',
      render: (row) => {
        const fCount = farms.filter((f) => f.farmerId === row.id).length
        const cCount = cases.filter((c) => c.farmerId === row.id).length
        const bCount = storageBatches.filter((b) => b.ownerId === row.id).length
        return <span className="text-xs text-muted">{fCount} farms · {cCount} cases · {bCount} batches</span>
      },
    },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
  ]
  return (
    <AdminCollectionPage
      eyebrow="Access control"
      title="User management"
      description="Review registered farmer, expert, and admin accounts across the platform."
      rows={users}
      columns={columns}
      searchable={(row) => [row.name, row.email, row.role, row.location]}
      filters={[roleFilter, statusFilter]}
      stats={[
        { label: 'Total users', value: users.length, detail: 'Registered accounts', icon: <Users size={18} />, tone: 'sage' },
        { label: 'Farmers', value: users.filter((u) => u.role === 'farmer').length, detail: 'Producer accounts', icon: <Users size={18} />, tone: 'forest' },
        { label: 'Experts', value: users.filter((u) => u.role === 'expert').length, detail: 'Specialist accounts', icon: <ShieldCheck size={18} />, tone: 'neutral' },
        { label: 'Active', value: users.filter((u) => u.status === 'active').length, detail: 'Currently enabled', icon: <ShieldCheck size={18} />, tone: 'sage' },
      ]}
      detailContent={(row) => {
        const userFarms = farms.filter((f) => f.farmerId === row.id)
        const userCases = cases.filter((c) => c.farmerId === row.id)
        const userBatches = storageBatches.filter((b) => b.ownerId === row.id)
        return (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Name</p><p className="font-semibold text-ink">{row.name}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Email</p><p className="font-semibold text-ink">{row.email}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Role</p><p className="font-semibold capitalize text-ink">{row.role}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Status</p><StatusPill status={row.status} /></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Location</p><p className="font-semibold text-ink">{row.location || 'Not provided'}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Joined</p><p className="font-semibold text-ink">{formatDate(row.joinedAt)}</p></div>
              <div className="sm:col-span-2"><p className="text-xs font-bold uppercase tracking-wide text-muted">Specialisation</p><p className="font-semibold text-ink">{row.specialisation ?? label(row.role)}</p></div>
            </div>

            {(userFarms.length > 0 || userCases.length > 0 || userBatches.length > 0) && (
              <div className="space-y-3 border-t border-line pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Synced user records</p>
                {userFarms.map((farm) => (
                  <div key={farm.id} className="rounded-2xl border border-line/80 bg-white/70 px-4 py-2.5 text-sm">
                    <span className="font-bold text-ink">Farm: {farm.name}</span>
                    <span className="ml-2 text-xs text-muted">{farm.location} · {farm.areaHa} ha · {farm.plots.length} plots</span>
                  </div>
                ))}
                {userCases.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-2xl border border-line/80 bg-white/70 px-4 py-2.5 text-sm">
                    <span className="font-semibold text-ink">Case: {c.crop} ({c.condition})</span>
                    <StatusPill status={c.status} />
                  </div>
                ))}
                {userBatches.map((batch) => (
                  <div key={batch.id} className="flex items-center justify-between gap-2 rounded-2xl border border-line/80 bg-white/70 px-4 py-2.5 text-sm">
                    <span className="font-semibold text-ink">Storage: {batch.code} · {batch.crop} ({formatNumber(batch.quantityKg)} kg)</span>
                    <StatusPill status={batch.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      }}
      confirm={{
        label: 'Toggle status',
        description: (row) => `${label(row.status === 'active' ? 'suspend' : 'activate')} ${row.name} across the backend database?`,
        onConfirm: (row) => updateUserStatus(row.id, row.status === 'active' ? 'suspended' : 'active'),
      }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </Button>
          <button type="button" className="text-sm font-bold text-forest underline" onClick={() => navigate('/admin/settings')}>Access policy</button>
        </div>
      }
    />
  )
}
