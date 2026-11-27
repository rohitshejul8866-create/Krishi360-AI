import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Bot, CheckCircle2, FileSearch, Info, Sparkles } from 'lucide-react'
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

export function AIAnalysisReview() {
  const [params, setParams] = useSearchParams()
  const { cases, reviewCase } = useApp()
  const { user } = useAuth()
  const { show } = useToast()
  const active = cases.find((item) => item.id === (params.get('id') ?? cases[0]?.id)) ?? cases[0]

  if (!active) return null

  const confirm = () => {
    reviewCase(
      active.id,
      'AI analysis summary reviewed by expert. Confidence and alternatives checked against submitted context.',
      '',
      'in_review',
      user?.name ?? 'Expert',
    )
    show('AI summary reviewed', `Case ${active.id} is marked in review.`, 'success')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Case workflow"
        title="AI Analysis Review"
        description="Inspect the AI triage output before recording expert observations."
        badge={
          active.provider === 'gemini' ? (
            <Badge tone="forest">Gemini AI{active.modelId ? ` · ${active.modelId}` : ''}</Badge>
          ) : (
            <DemoNote label="Pattern-based simulation" />
          )
        }
        actions={
          <Select
            value={active.id}
            onChange={(event) => setParams({ id: event.target.value })}
            options={cases.map((item) => ({ value: item.id, label: `${item.id} · ${item.crop}` }))}
            className="w-64"
            aria-label="Select case for AI review"
          />
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge tone="sage">{active.id}</Badge>
              <h2 className="mt-4 text-2xl font-extrabold text-ink">{active.condition}</h2>
              <p className="mt-2 text-sm text-muted">{active.crop} · {active.plantPart} · {active.farmerName}</p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-forest text-white"><Bot size={22} /></span>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {[
              { label: active.provider === 'gemini' ? 'AI confidence' : 'Demo confidence', value: `${active.confidence}%` },
              { label: 'Alternatives', value: active.alternatives.length },
              { label: 'Symptoms mapped', value: active.observedSymptoms.length },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-soft-sage/45 p-4">
                <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">{item.label}</p>
                <p className="mt-2 text-2xl font-extrabold text-ink">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-7">
            <div className="flex items-center justify-between"><h3 className="text-sm font-extrabold text-ink">Confidence assessment</h3><StatusPill status={active.reviewStatus} /></div>
            <div className="mt-4"><Progress value={active.confidence} label="Pattern similarity" /></div>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Confidence expresses similarity to sample reference patterns in this demo. It is not a probability of disease and not a clinical or agronomic diagnosis.
            </p>
          </div>

          <div className="mt-7">
            <h3 className="text-sm font-extrabold text-ink">Alternative possibilities</h3>
            <div className="mt-3 space-y-2">
              {active.alternatives.map((alternative) => (
                <div key={alternative.name} className="flex items-center justify-between rounded-2xl border border-line/70 px-4 py-3 text-sm">
                  <span className="font-semibold text-ink">{alternative.name}</span>
                  <span className="text-xs text-muted">{alternative.confidence}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Analysis explanation" description="Plain-language output shown to the farmer." icon={<Sparkles size={18} />} />
            <p className="text-sm leading-relaxed text-ink">{active.explanation}</p>
            <div className="mt-5">
              <p className="text-xs font-extrabold tracking-wide text-muted uppercase">Suggested next steps</p>
              <ol className="mt-3 space-y-2">
                {active.nextSteps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-xs text-muted">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-soft-sage text-[10px] font-extrabold text-forest">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          <Card>
            <CardHeader title="Expert review decision" description="Record that you checked the AI summary." icon={<CheckCircle2 size={18} />} />
            <div className="flex items-start gap-2 rounded-2xl bg-[#FBF1DC] p-4 text-xs text-[#8A6520]">
              <Info size={15} className="mt-0.5 shrink-0" />
              This marks workflow state only. Detailed observations belong in Expert Feedback.
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={confirm} disabled={active.reviewStatus === 'in_review' || active.reviewStatus === 'completed'}>
                <CheckCircle2 size={15} /> Mark summary reviewed
              </Button>
              <Link to={`/expert/feedback?id=${active.id}`} className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white/70 px-5 py-2.5 text-sm font-bold text-forest hover:border-sage">
                Continue to feedback <ArrowRight size={14} />
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Evidence preview" description="Image linked to this AI analysis." icon={<FileSearch size={18} />} />
            <img src={active.imageUrl} alt="Evidence for AI review" className="aspect-[4/3] w-full rounded-2xl border border-line object-cover" />
          </Card>
        </div>
      </div>
    </div>
  )
}
