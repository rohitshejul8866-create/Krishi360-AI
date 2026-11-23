import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, KeyRound, ShieldCheck, Users } from 'lucide-react'
import { Button, buttonClasses } from '../../components/ui/Button'
import { StatusPill } from '../../components/ui/Badge'
import { useApp } from '../../services/store'
import { AdminCollectionPage, type AdminFilter } from './AdminCollectionPage'
import { AdminAddUserModal } from './AdminAddUserModal'
import type { Column } from '../../components/ui/Table'

type AdminUser = ReturnType<typeof useApp>['users'][number]

export function ExpertManagementPage() {
  const { users, updateUserStatus } = useApp()
  const [adding, setAdding] = useState(false)
  const experts = useMemo(() => users.filter((user) => user.role === 'expert'), [users])
  const statusFilter: AdminFilter<AdminUser> = { label: 'Status', options: ['active', 'invited', 'suspended'], value: (row) => row.status }
  const specialisationFilter: AdminFilter<AdminUser> = {
    label: 'Specialisation',
    options: [...new Set(experts.map((expert) => expert.specialisation ?? 'General'))],
    value: (row) => row.specialisation ?? 'General',
  }
  const columns: Column<AdminUser>[] = [
    { key: 'name', label: 'Expert', render: (row) => <div><p className="font-bold text-ink">{row.name}</p><p className="text-xs text-muted">{row.email}</p></div> },
    { key: 'specialisation', label: 'Specialisation', render: (row) => row.specialisation ?? 'General' },
    { key: 'location', label: 'Location', render: (row) => row.location },
    { key: 'status', label: 'Status', render: (row) => <StatusPill status={row.status} /> },
  ]
  return (
    <>
      <AdminCollectionPage
        eyebrow="Expert network"
        title="Expert management"
        description="Provision Crop Expert login accounts, manage case-review availability, or open the direct Crop Expert login panel."
        rows={experts}
        columns={columns}
        searchable={(row) => [row.name, row.email, row.location, row.specialisation ?? '']}
        filters={[specialisationFilter, statusFilter]}
        stats={[
          { label: 'Experts', value: experts.length, detail: 'Specialist accounts', icon: <Users size={18} />, tone: 'sage' },
          { label: 'Active', value: experts.filter((expert) => expert.status === 'active').length, detail: 'Available for review', icon: <ShieldCheck size={18} />, tone: 'forest' },
          { label: 'Specialisations', value: new Set(experts.map((expert) => expert.specialisation)).size, detail: 'Areas of expertise', icon: <Award size={18} />, tone: 'neutral' },
          { label: 'Invited', value: experts.filter((expert) => expert.status === 'invited').length, detail: 'Pending activation', icon: <Award size={18} />, tone: 'alert' },
        ]}
        detailContent={(row) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Expert</p><p className="font-semibold text-ink">{row.name}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Email</p><p className="font-semibold text-ink">{row.email}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Specialisation</p><p className="font-semibold text-ink">{row.specialisation ?? 'General'}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Organisation</p><p className="font-semibold text-ink">{row.organisation ?? '—'}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Location</p><p className="font-semibold text-ink">{row.location}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Status</p><StatusPill status={row.status} /></div>
          </div>
        )}
        confirm={{
          label: 'Toggle status',
          description: (row) => `${row.status === 'active' ? 'Suspend' : 'Activate'} ${row.name} in the backend user directory?`,
          onConfirm: (row) => updateUserStatus(row.id, row.status === 'active' ? 'suspended' : 'active'),
        }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/expert/login" className={buttonClasses('outline', 'sm')}>
              <KeyRound size={14} /> Crop Expert Login Panel
            </Link>
            <Button size="sm" onClick={() => setAdding(true)}>Add expert</Button>
          </div>
        }
      />
      <AdminAddUserModal role="expert" open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
