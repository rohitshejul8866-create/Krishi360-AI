import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, Database, Download, RotateCcw, Save, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button, buttonClasses } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Input'
import { useToast } from '../../context/ToastContext'
import { useApp } from '../../services/store'
import type { PlatformSettings } from '../../types'

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-5 rounded-2xl border border-line/80 bg-white/60 px-4 py-4">
      <div>
        <p className="text-sm font-extrabold text-ink">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 ${checked ? 'bg-forest' : 'bg-line'}`}
      >
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  )
}

export function PlatformSettingsPage() {
  const { settings, updateSettings, addAuditLog, notify, backendConnected } = useApp()
  const { show } = useToast()
  const [draft, setDraft] = useState<PlatformSettings>(settings)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const set = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const save = async () => {
    const next: Record<string, string> = {}
    if (draft.expertReviewSlaHours < 1 || draft.expertReviewSlaHours > 168) next.sla = 'Choose between 1 and 168 hours.'
    if (draft.storageAlertTemp < -10 || draft.storageAlertTemp > 60) next.temp = 'Choose between -10°C and 60°C.'
    if (draft.storageAlertHumidity < 0 || draft.storageAlertHumidity > 100) next.humidity = 'Choose between 0% and 100%.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setSaving(true)
    try {
      await updateSettings(draft)
      addAuditLog('Admin User', 'admin', 'Updated platform settings', 'SETTINGS#global')
      show(
        'Settings saved',
        backendConnected
          ? 'Platform configuration persisted to the backend database.'
          : 'Preferences updated in local store.',
        'success',
      )
    } finally {
      setSaving(false)
    }
  }

  const exportSettings = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'krishi360-platform-settings.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    show('Settings exported', 'Current platform preferences downloaded as JSON.')
  }

  const sendTestNotification = () => {
    if (!draft.notificationsEnabled) {
      show('Notifications disabled', 'Enable platform notifications before sending a test.', 'warning')
      return
    }
    notify({ title: 'Test platform notification', body: 'Platform settings broadcast persisted via notification service.', severity: 'info', audience: 'admin' })
    show('Test notification created', 'Admin notification persisted to active feed.')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="Platform settings"
        description="Configure platform defaults, SLA thresholds, and alert limits persisted in the backend database."
        badge={<Badge tone={backendConnected ? 'forest' : 'sage'}>{backendConnected ? 'Database synced' : 'Local store'}</Badge>}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={exportSettings}><Download size={14} /> Export</Button>
            <Button size="sm" disabled={saving} onClick={() => void save()}><Save size={14} /> {saving ? 'Saving…' : 'Save changes'}</Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader title="General preferences" description="Global configuration stored in the single-table SETTINGS#global record." icon={<SlidersHorizontal size={18} />} />
          <div className="space-y-4">
            <Field label="Interface language label" hint="Persisted per platform configuration.">
              <Select value={draft.language} onChange={(event) => set('language', event.target.value)} options={[{ value: 'English', label: 'English' }, { value: 'हिन्दी', label: 'हिन्दी' }, { value: 'मराठी', label: 'मराठी' }]} />
            </Field>
            <Toggle label="Platform notifications" description="Allow notifications to be generated and stored in the notification feed." checked={draft.notificationsEnabled} onChange={(value) => set('notificationsEnabled', value)} />
            <Toggle label="Demo labels" description="Display indicative/sample badges on demonstration telemetry." checked={draft.demoMode} onChange={(value) => set('demoMode', value)} />
            <Toggle label="Compact tables" description="Reduce row padding across management tables." checked={draft.compactTables} onChange={(value) => set('compactTables', value)} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Expert SLA (hours)" error={errors.sla}><Input type="number" min="1" max="168" value={draft.expertReviewSlaHours} onChange={(event) => set('expertReviewSlaHours', Number(event.target.value))} /></Field>
              <Field label="Storage temp alert (°C)" error={errors.temp}><Input type="number" min="-10" max="60" value={draft.storageAlertTemp} onChange={(event) => set('storageAlertTemp', Number(event.target.value))} /></Field>
              <Field label="Humidity alert (%)" error={errors.humidity}><Input type="number" min="0" max="100" value={draft.storageAlertHumidity} onChange={(event) => set('storageAlertHumidity', Number(event.target.value))} /></Field>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button disabled={saving} onClick={() => void save()}><Save size={15} /> {saving ? 'Saving…' : 'Save changes'}</Button>
              <Button variant="ghost" onClick={() => { setDraft(settings); setErrors({}); show('Changes discarded', 'Draft settings were restored.') }}><RotateCcw size={15} /> Discard</Button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Access & roles" description="Authentication and role boundaries for the three portals." icon={<ShieldCheck size={18} />} />
            <div className="space-y-3 text-sm leading-relaxed text-ink">
              <p>Public sign-up (<code className="rounded bg-soft-sage px-1.5 py-0.5 text-xs text-forest">/register</code>) and farmer login (<code className="rounded bg-soft-sage px-1.5 py-0.5 text-xs text-forest">/login</code>) issue signed Bearer sessions verified against hashed backend credentials.</p>
              <p>Crop Experts and Administrators sign in directly via the staff panel at <code className="rounded bg-soft-sage px-1.5 py-0.5 text-xs text-forest">/expert/login</code> and <code className="rounded bg-soft-sage px-1.5 py-0.5 text-xs text-forest">/admin/login</code>.</p>
              <div className="flex flex-wrap gap-2">
                <Link to="/admin/users" className={buttonClasses('outline', 'sm')}>
                  <Users size={14} /> Review accounts
                </Link>
                <Link to="/admin/experts" className={buttonClasses('outline', 'sm')}>
                  Crop Expert access
                </Link>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Database & single-table storage" description="Connected Express API with persistent SQLite WAL & AWS DynamoDB." icon={<Database size={18} />} />
            <div className="space-y-3 text-sm leading-relaxed text-ink">
              <p>Cases, mandi prices, schemes, storage batches, farms, user accounts, notifications, and audit logs persist through the <code className="rounded bg-soft-sage px-1.5 py-0.5 text-xs text-forest">/api/*</code> backend repository layer (SQLite WAL locally or AWS DynamoDB in cloud environments).</p>
              <div className="flex flex-wrap gap-2">
                <Link to="/admin/backend" className={buttonClasses('outline', 'sm')}>
                  <Database size={14} /> Open Backend & DB
                </Link>
                <Button size="sm" variant="outline" onClick={sendTestNotification}><BellRing size={14} /> Send test notification</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
