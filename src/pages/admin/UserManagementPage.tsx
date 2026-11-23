import { ShieldCheck, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../services/store'
import { StatusPill } from '../../components/ui/Badge'
import { AdminCollectionPage, type AdminFilter } from './AdminCollectionPage'
import type { Column } from '../../components/ui/Table'

type AdminUser = ReturnType<typeof useApp>['users'][number]

const roleFilter: AdminFilter<AdminUser> = { label: 'Role', options: ['farmer', 'expert', 'admin'], value: (row) => row.role }
const statusFilter: AdminFilter<AdminUser> = { label: 'Status', options: ['active', 'invited', 'suspended'], value: (row) => row.status }
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

export function UserManagementPage() {
  const { users, updateUserStatus } = useApp()
  const navigate = useNavigate()
  const columns: Column<AdminUser>[] = [
    { key: 'name', label: 'User', render: (row) => <div><p className="font-bold text-ink">{row.name}</p><p className="text-xs text-muted">{row.email}</p></div> },
    { key: 'role', label: 'Role', render: (row) => <span className="text-sm capitalize text-ink">{row.role}</span> },
    { key: 'location', label: 'Location', render: (row) => row.location || '—' },
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
        { label: 'Farmers', value: users.filter((user) => user.role === 'farmer').length, detail: 'Producer accounts', icon: <Users size={18} />, tone: 'forest' },
        { label: 'Experts', value: users.filter((user) => user.role === 'expert').length, detail: 'Specialist accounts', icon: <ShieldCheck size={18} />, tone: 'neutral' },
        { label: 'Active', value: users.filter((user) => user.status === 'active').length, detail: 'Currently enabled', icon: <ShieldCheck size={18} />, tone: 'sage' },
      ]}
      detailContent={(row) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Name</p><p className="font-semibold text-ink">{row.name}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Email</p><p className="font-semibold text-ink">{row.email}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Role</p><p className="font-semibold capitalize text-ink">{row.role}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Status</p><StatusPill status={row.status} /></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Location</p><p className="font-semibold text-ink">{row.location || 'Not provided'}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Joined</p><p className="font-semibold text-ink">{row.joinedAt}</p></div>
          <div className="sm:col-span-2"><p className="text-xs font-bold uppercase tracking-wide text-muted">Specialisation</p><p className="font-semibold text-ink">{row.specialisation ?? label(row.role)}</p></div>
        </div>
      )}
      confirm={{
        label: 'Toggle status',
        description: (row) => `${label(row.status === 'active' ? 'suspend' : 'activate')} ${row.name} across the backend database?`,
        onConfirm: (row) => updateUserStatus(row.id, row.status === 'active' ? 'suspended' : 'active'),
      }}
      actions={<button type="button" className="text-sm font-bold text-forest underline" onClick={() => navigate('/admin/settings')}>Access policy</button>}
    />
  )
}
