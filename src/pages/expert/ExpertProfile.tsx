import { useState } from 'react'
import type { FormEvent } from 'react'
import { Award, Building2, MapPin, UserRound } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useApp } from '../../services/store'
import { formatDate } from '../../services/utils'

export function ExpertProfile() {
  const { user, updateProfile } = useAuth()
  const { cases } = useApp()
  const { show } = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [location, setLocation] = useState(user?.location ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  if (!user) return null

  const completed = cases.filter((item) => item.reviewedBy === user.name && item.reviewStatus === 'completed').length

  const save = (event: FormEvent) => {
    event.preventDefault()
    updateProfile({ name: name.trim() || user.name, location, phone })
    show('Expert profile updated', 'Saved for this demo session.', 'success')
  }

  return (
    <div>
      <PageHeader eyebrow="Account" title="Expert Profile" description="Your Crop Expert identity and case review activity." />

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <div className="flex flex-col items-center text-center">
            <span className="flex size-24 items-center justify-center rounded-[28px] bg-linear-to-br from-sage to-forest text-2xl font-extrabold text-white">{user.avatar}</span>
            <h2 className="mt-5 text-xl font-extrabold text-ink">{user.name}</h2>
            <p className="mt-1 text-sm text-muted">{user.email}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Badge tone="sage">Agriculture expert</Badge>
              <Badge tone="success">{user.status}</Badge>
            </div>
          </div>
          <div className="mt-7 space-y-3 border-t border-line/70 pt-6">
            {[
              { icon: Building2, label: 'Organisation', value: user.organisation ?? '—' },
              { icon: Award, label: 'Specialisation', value: user.specialisation ?? '—' },
              { icon: MapPin, label: 'Location', value: user.location },
              { icon: UserRound, label: 'Member since', value: formatDate(user.joinedAt) },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-2xl bg-soft-sage/40 p-3.5">
                  <Icon size={16} className="text-forest" />
                  <div>
                    <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">{item.label}</p>
                    <p className="mt-0.5 text-xs font-bold text-ink">{item.value}</p>
                  </div>
                </div>
              )
            })}
            <div className="rounded-2xl bg-forest p-4 text-white">
              <p className="text-3xl font-extrabold">{completed}</p>
              <p className="mt-1 text-xs text-white/70">Completed case reviews</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Edit expert details" description="Update your Crop Expert profile details." icon={<UserRound size={18} />} />
          <form onSubmit={save} className="space-y-5">
            <Field label="Full name" required><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Email address" hint="Managed by Administrator"><Input value={user.email} disabled /></Field>
            <Field label="Location"><Input value={location} onChange={(event) => setLocation(event.target.value)} /></Field>
            <Field label="Phone"><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
            <div className="flex justify-end gap-3 border-t border-line/70 pt-5">
              <Button type="button" variant="ghost" onClick={() => { setName(user.name); setLocation(user.location); setPhone(user.phone) }}>Reset</Button>
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
