import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, FileImage, FileSearch, Info, MapPin, MessageSquareText, Sprout } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge, StatusPill } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'
import { Progress } from '../../components/ui/Progress'
import { useApp } from '../../services/store'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, formatDateTime } from '../../services/utils'

export function CaseDetails() {
  const [params, setParams] = useSearchParams()
  const { cases, reviewCase, notify } = useApp()
  const { user } = useAuth()
  const { show } = useToast()
  const activeId = params.get('id') ?? cases[0]?.id
  const active = cases.find((item) => item.id === activeId) ?? cases[0]

  if (!active) return null

  const requestInfo = () => {
    reviewCase(
      active.id,
      'Additional field information requested by the expert.',
      'Please share a clearer close-up and recent irrigation details through CropDoctor AI.',
      'needs_info',
      user?.name ?? 'Expert',
    )
    notify({
      title: 'More information requested',
      body: `Expert requested additional details for ${active.id}.`,
      severity: 'warning',
      audience: 'farmer',
    })
    show('Information request recorded', `Case ${active.id} moved to needs info.`, 'warning')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Case workflow"
        title="Crop Case Details"
        description="Review submission context, image evidence and the labelled AI analysis."
        badge={<DemoNote label="Simulated evidence" />}
        actions={
          <Select
            value={active.id}
            onChange={(event) => setParams({ id: event.target.value })}
            options={cases.map((item) => ({ value: item.id, label: `${item.id} · ${item.crop}` }))}
            className="w-64"
            aria-label="Select case"
          />
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge tone="sage">{active.id}</Badge>
                <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{active.condition}</h2>
                <p className="mt-2 text-sm text-muted">Submitted by {active.farmerName}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill status={active.priority} />
                <StatusPill status={active.reviewStatus} />
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { icon: Sprout, label: 'Crop', value: active.crop },
                { icon: FileSearch, label: 'Plant part', value: active.plantPart },
                { icon: MapPin, label: 'Location', value: active.location },
                { icon: CalendarDays, label: 'Submitted', value: formatDateTime(active.submittedAt) },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-2xl bg-soft-sage/40 p-4">
                    <Icon size={17} className="text-forest" />
                    <div>
                      <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">{item.label}</p>
                      <p className="mt-0.5 text-sm font-bold text-ink">{item.value}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Farmer-submitted image" description="Demo image evidence. Never treated as confirmed diagnosis." icon={<FileImage size={18} />} />
            <img src={active.imageUrl} alt={`Crop sample for case ${active.id}`} className="aspect-[4/3] w-full rounded-2xl border border-line object-cover" />
            <div className="mt-4 rounded-2xl bg-soft-sage/40 p-4">
              <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">Farmer symptoms</p>
              <p className="mt-2 text-sm text-ink">{active.symptoms || 'No additional symptoms provided.'}</p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="AI analysis summary" description="Pattern-based demo output with confidence." icon={<FileSearch size={18} />} action={<DemoNote label="Not verified" />} />
            <div className="rounded-2xl bg-soft-sage/50 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold text-ink">Confidence</p>
                <p className="text-2xl font-extrabold text-forest">{active.confidence}%</p>
              </div>
              <div className="mt-3"><Progress value={active.confidence} /></div>
            </div>
            <div className="mt-5">
              <p className="text-xs font-extrabold tracking-wide text-muted uppercase">Observed symptoms</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {active.observedSymptoms.map((symptom) => <Badge key={symptom} tone="neutral">{symptom}</Badge>)}
              </div>
            </div>
            <div className="mt-5">
              <p className="text-xs font-extrabold tracking-wide text-muted uppercase">Alternatives</p>
              <div className="mt-3 space-y-2">
                {active.alternatives.map((alternative) => (
                  <div key={alternative.name} className="flex items-center justify-between rounded-2xl border border-line/70 px-4 py-2.5 text-xs">
                    <span className="font-semibold text-ink">{alternative.name}</span>
                    <span className="text-muted">{alternative.confidence}%</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-5 text-xs leading-relaxed text-muted">{active.explanation}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to={`/expert/ai-review?id=${active.id}`} className="inline-flex items-center gap-2 rounded-2xl bg-forest px-4 py-2.5 text-xs font-bold text-white hover:bg-[#2b402c]">Open AI review <ArrowRight size={14} /></Link>
              <Link to={`/expert/feedback?id=${active.id}`} className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white/70 px-4 py-2.5 text-xs font-bold text-forest hover:border-sage">Give feedback</Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Expert actions" description="Simulated case workflow controls." icon={<MessageSquareText size={18} />} />
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={requestInfo} disabled={active.reviewStatus === 'completed'}>
                Request more information
              </Button>
              <Link to={`/expert/feedback?id=${active.id}`} className="flex min-h-11 items-center gap-2 rounded-2xl bg-soft-sage px-5 py-2.5 text-sm font-semibold text-forest">Record expert guidance</Link>
            </div>
            <div className="mt-5 flex items-start gap-2 rounded-2xl bg-[#FBF1DC] p-4 text-xs text-[#8A6520]">
              <Info size={15} className="mt-0.5 shrink-0" />
              Any guidance recorded here is demo-only and visible in the farmer case history.
            </div>
          </Card>

          {active.expertGuidance ? (
            <Card>
              <CardHeader title="Recorded guidance" description={`Reviewed ${active.reviewedAt ? formatDate(active.reviewedAt) : 'recently'} by ${active.reviewedBy ?? 'expert'}.`} icon={<MessageSquareText size={18} />} />
              <p className="text-sm leading-relaxed text-ink">{active.expertGuidance}</p>
              {active.expertNotes ? <p className="mt-4 rounded-2xl bg-soft-sage/40 p-4 text-xs text-muted">{active.expertNotes}</p> : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
