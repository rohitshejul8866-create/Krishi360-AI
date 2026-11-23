import { useMemo, useState } from 'react'
import { Sprout, UserRoundCheck, Users } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StatusPill } from '../../components/ui/Badge'
import { useApp } from '../../services/store'
import { AdminCollectionPage, type AdminFilter } from './AdminCollectionPage'
import { AdminAddUserModal } from './AdminAddUserModal'
import type { Column } from '../../components/ui/Table'

type AdminUser = ReturnType<typeof useApp>['users'][number]

export function FarmerManagementPage() {
  const { users, updateUserStatus } = useApp()
  const [adding, setAdding] = useState(false)
  const farmers = useMemo(() => users.filter((user) => user.role === 'farmer'), [users])
  const locationFilter: AdminFilter<AdminUser> = {
    label: 'Location',
    options: [...new Set(farmers.map((farmer) => farmer.location.split(',')[0].trim()))],
    value: (row) => row.location.split(',')[0].trim(),
  }
  const statusFilter: AdminFilter<AdminUser> = { label: 'Status', options: ['active', 'invited', 'suspended'], value: (row) => row.status }
  const columns: Column<AdminUser>[] = [
    { key: 'name', label: 'Farmer', render: (row) => <div><p className="font-bold text-ink">{row.name}</p><p className="text-xs text-muted">{row.email}</p></div> },
    { key: 'location', label: 'Location', render: (row) => row.location },
    { key: 'phone', label: 'Phone', render: (row) => row.phone },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
  ]
  return (
    <>
      <AdminCollectionPage
        eyebrow="Farmer network"
        title="Farmer management"
        description="Manage registered farmer accounts and regional access across the platform."
        rows={farmers}
        columns={columns}
        searchable={(row) => [row.name, row.email, row.location, row.phone]}
        filters={[locationFilter, statusFilter]}
        stats={[
          { label: 'Farmers', value: farmers.length, detail: 'Registered growers', icon: <Users size={18} />, tone: 'sage' },
          { label: 'Active', value: farmers.filter((farmer) => farmer.status === 'active').length, detail: 'Ready to use portals', icon: <UserRoundCheck size={18} />, tone: 'forest' },
          { label: 'Locations', value: new Set(farmers.map((farmer) => farmer.location)).size, detail: 'Distinct regions', icon: <Sprout size={18} />, tone: 'neutral' },
          { label: 'Invited', value: farmers.filter((farmer) => farmer.status === 'invited').length, detail: 'Pending activation', icon: <Sprout size={18} />, tone: 'alert' },
        ]}
        detailContent={(row) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Farmer</p><p className="font-semibold text-ink">{row.name}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Email</p><p className="font-semibold text-ink">{row.email}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Location</p><p className="font-semibold text-ink">{row.location}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Phone</p><p className="font-semibold text-ink">{row.phone}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Status</p><StatusPill status={row.status} /></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Joined</p><p className="font-semibold text-ink">{row.joinedAt}</p></div>
          </div>
        )}
        confirm={{
          label: 'Toggle status',
          description: (row) => `${row.status === 'active' ? 'Suspend' : 'Activate'} ${row.name} in the backend user directory?`,
          onConfirm: (row) => updateUserStatus(row.id, row.status === 'active' ? 'suspended' : 'active'),
        }}
        actions={<Button size="sm" onClick={() => setAdding(true)}>Add farmer</Button>}
      />
      <AdminAddUserModal role="farmer" open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
