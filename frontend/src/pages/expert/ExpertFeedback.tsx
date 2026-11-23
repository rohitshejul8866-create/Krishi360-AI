import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, MessageSquareText, Send, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge, StatusPill } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Select, Textarea } from '../../components/ui/Input'
import { useApp } from '../../services/store'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import type { ReviewStatus } from '../../types'

export function ExpertFeedback() {
  const [params] = useSearchParams()
  const { cases, reviewCase, notify, addAuditLog } = useApp()
  const { user } = useAuth()
  const { show } = useToast()
  const active = cases.find((item) => item.id === (params.get('id') ?? cases[0]?.id)) ?? cases[0]
  const [observations, setObservations] = useState('')
  const [guidance, setGuidance] = useState('')
  const [status, setStatus] = useState<ReviewStatus>('completed')

  if (!active) return null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (observations.trim().length < 10) {
      show('More detail needed', 'Add at least 10 characters of expert observations.', 'warning')
      return
    }
    if (guidance.trim().length < 10) {
      show('More detail needed', 'Add safe next-step guidance for the farmer.', 'warning')
      return
    }
    reviewCase(active.id, observations.trim(), guidance.trim(), status, user?.name ?? 'Expert')
    notify({
      title: status === 'needs_info' ? 'More information requested' : 'Expert guidance available',
      body: `${active.id} was reviewed in the demo expert portal.`,
      severity: status === 'needs_info' ? 'warning' : 'success',
      audience: 'farmer',
    })
    addAuditLog(user?.name ?? 'Expert', 'expert', `Recorded ${status} feedback`, active.id)
    show('Feedback recorded', `Case ${active.id} updated and farmer notified.`, 'success')
    setObservations('')
    setGuidance('')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Case workflow"
        title="Expert Feedback"
        description="Record observations, safe guidance and the review status for a demo crop case."
        badge={<DemoNote label="Demo-only guidance" />}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge tone="sage">{active.id}</Badge>
              <h2 className="mt-4 text-2xl font-extrabold text-ink">{active.condition}</h2>
              <p className="mt-2 text-sm text-muted">{active.crop} · {active.farmerName} · {active.location}</p>
            </div>
            <StatusPill status={active.reviewStatus} />
          </div>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <Field label="Expert observations" required hint="Describe what you can verify from the submitted context.">
              <Textarea
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
                placeholder="Example: Visual pattern is consistent with the submitted description; whole-plant context would improve confidence."
                className="min-h-36"
              />
            </Field>
            <Field label="Safe next-step guidance" required hint="Do not provide chemical dosages or unverified treatment claims.">
              <Textarea
                value={guidance}
                onChange={(event) => setGuidance(event.target.value)}
                placeholder="Example: Keep records of affected plants and consult your local extension officer for confirmation."
                className="min-h-32"
              />
            </Field>
            <Field label="Review status">
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as ReviewStatus)}
                options={[
                  { value: 'in_review', label: 'In review' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'needs_info', label: 'Needs more information' },
                ]}
              />
            </Field>
            <div className="flex flex-wrap justify-end gap-3 border-t border-line/70 pt-5">
              <Button type="button" variant="ghost" onClick={() => { setObservations(''); setGuidance('') }}>Clear form</Button>
              <Button type="submit"><Send size={15} /> Submit feedback</Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Review checklist" description="Before submitting expert feedback." icon={<CheckCircle2 size={18} />} />
            <ul className="space-y-3 text-xs leading-relaxed text-muted">
              <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-forest" /> Keep advice observational and non-prescriptive.</li>
              <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-forest" /> Avoid chemical names, dosages or application schedules.</li>
              <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-forest" /> Acknowledge limits of the submitted image.</li>
              <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-forest" /> Request more information when context is missing.</li>
            </ul>
          </Card>

          <Card>
            <CardHeader title="Original AI output" description="For comparison while reviewing." icon={<MessageSquareText size={18} />} />
            <div className="rounded-2xl bg-soft-sage/45 p-4">
              <p className="text-sm font-extrabold text-ink">{active.condition}</p>
              <p className="mt-1 text-xs text-muted">{active.confidence}% demo confidence</p>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">{active.explanation}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {active.observedSymptoms.map((symptom) => <Badge key={symptom} tone="neutral">{symptom}</Badge>)}
            </div>
          </Card>

          {active.expertGuidance ? (
            <Card>
              <CardHeader title="Last recorded guidance" description={`Reviewed by ${active.reviewedBy ?? 'expert'}.`} icon={<MessageSquareText size={18} />} />
              <p className="text-sm leading-relaxed text-ink">{active.expertGuidance}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
