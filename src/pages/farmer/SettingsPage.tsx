import { useState } from 'react'
import type { ReactNode } from 'react'
import { Bell, Database, Globe2, Settings2 } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { Card, CardHeader } from '../../components/ui/Card'
import { Field, Select } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useApp } from '../../services/store'
import { useToast } from '../../context/ToastContext'

export function SettingsPage() {
  const { settings, updateSettings, backendConnected } = useApp()
  const { show } = useToast()
  const [language, setLanguage] = useState(settings.language)
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled)
  const [compactTables, setCompactTables] = useState(settings.compactTables)

  const save = () => {
    updateSettings({ language, notificationsEnabled, compactTables })
    show('Settings saved', 'Preferences updated for this session.', 'success')
  }

  return (
    <div>
      <PageHeader eyebrow="Account" title="Settings" description="Adjust portal preferences and review your active session configuration." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="General preferences" description="Configure language, notifications, and table density." icon={<Settings2 size={18} />} />
          <div className="space-y-5">
            <Field label="Preferred language">
              <Select value={language} onChange={(event) => setLanguage(event.target.value)} options={[
                { value: 'English', label: 'English' },
                { value: 'हिन्दी', label: 'हिन्दी' },
                { value: 'मराठी', label: 'मराठी' },
              ]} />
            </Field>
            <ToggleRow icon={<Bell size={17} />} label="Portal notifications" description="Show notification indicators in the portal shell." checked={notificationsEnabled} onChange={setNotificationsEnabled} />
            <ToggleRow icon={<Database size={17} />} label="Compact tables" description="Use denser rows in data-heavy screens." checked={compactTables} onChange={setCompactTables} />
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={save}>Save preferences</Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Environment status" description="Active backend and authentication configuration." icon={<Globe2 size={18} />} />
          <div className="space-y-3">
            {[
              { label: 'Backend connection', value: backendConnected ? 'Connected (/api)' : 'Local session fallback' },
              { label: 'Authentication', value: 'Signed Bearer session' },
              { label: 'Registration scope', value: 'Farmer portal' },
              { label: 'Staff access', value: 'Direct Admin / Expert panel' },
              { label: 'Access policy', value: 'Role-based portals' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl bg-soft-sage/40 px-4 py-3 text-sm">
                <span className="text-muted">{item.label}</span>
                <span className="font-extrabold text-ink">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: ReactNode
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-line/70 bg-white/60 p-4">
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-soft-sage text-forest">{icon}</span>
        <div>
          <p className="text-sm font-bold text-ink">{label}</p>
          <p className="mt-1 text-xs text-muted">{description}</p>
        </div>
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 size-5 accent-[#344B35]" />
    </label>
  )
}
