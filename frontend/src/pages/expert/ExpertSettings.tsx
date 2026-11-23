import { useState } from 'react'
import { Clock3, MessageSquareText, Settings2 } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Input'
import { useApp } from '../../services/store'
import { useToast } from '../../context/ToastContext'

export function ExpertSettings() {
  const { settings, updateSettings } = useApp()
  const { show } = useToast()
  const [sla, setSla] = useState(settings.expertReviewSlaHours)
  const [autoAssign, setAutoAssign] = useState(true)

  return (
    <div>
      <PageHeader eyebrow="Account" title="Expert Settings" description="Configure demo review preferences for the expert workspace." badge={<DemoNote label="Session only" />} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Review preferences" description="These settings affect labels in this demo only." icon={<Settings2 size={18} />} />
          <div className="space-y-5">
            <Field label="Target review window (hours)" hint="Displayed as a demo operational target.">
              <Input type="number" min="1" max="168" value={sla} onChange={(event) => setSla(Number(event.target.value))} />
            </Field>
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-line/70 bg-white/60 p-4">
              <div className="flex gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-soft-sage text-forest"><MessageSquareText size={16} /></span>
                <div>
                  <p className="text-sm font-bold text-ink">Demo auto-assignment</p>
                  <p className="mt-1 text-xs text-muted">Show new cases as assigned to this expert.</p>
                </div>
              </div>
              <input type="checkbox" checked={autoAssign} onChange={(event) => setAutoAssign(event.target.checked)} className="mt-1 size-5 accent-[#344B35]" />
            </label>
            <Button onClick={() => { updateSettings({ expertReviewSlaHours: sla }); show('Settings saved', 'Expert preferences updated.', 'success') }}>Save preferences</Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Review principles" description="Recommended practice in this simulated workspace." icon={<Clock3 size={18} />} />
          <ul className="space-y-3 text-xs leading-relaxed text-muted">
            <li>• Treat AI output as a triage aid, not a diagnosis.</li>
            <li>• Record what can and cannot be verified from submitted evidence.</li>
            <li>• Avoid chemical recommendations and dosage instructions.</li>
            <li>• Request additional context when symptoms are ambiguous.</li>
          </ul>
          <div className="mt-6 rounded-2xl bg-forest p-4 text-white">
            <p className="text-[11px] font-extrabold tracking-wide text-sage uppercase">Current demo target</p>
            <p className="mt-2 text-2xl font-extrabold">{sla} hours</p>
            <p className="mt-1 text-xs text-white/70">No real service-level agreement is implied.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
