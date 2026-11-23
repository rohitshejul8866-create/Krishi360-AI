import { useMemo, useState } from 'react'
import { ArrowUpRight, Bookmark, BookmarkCheck, CheckCircle2, ExternalLink, FileText, Landmark, Search } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { FilterBar } from '../../components/common/FilterBar'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Input'
import { Progress } from '../../components/ui/Progress'
import { Modal } from '../../components/ui/Modal'
import { useApp } from '../../services/store'
import { useToast } from '../../context/ToastContext'
import { schemeService } from '../../services/schemeService'
import { SCHEME_CATEGORIES, SCHEME_STATES } from '../../data/schemes'
import { formatDate } from '../../services/utils'
import type { BackendEligibilityResult } from '../../services/apiMappers'
import type { Scheme } from '../../types'

export function SchemeSaathiPage() {
  const { schemes, savedSchemeIds, applications, saveScheme, unsaveScheme, startApplication, advanceApplication, checkSchemeEligibility } = useApp()
  const { show } = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const [state, setState] = useState('All states')
  const [selected, setSelected] = useState<Scheme | null>(null)
  const [profileState, setProfileState] = useState('Maharashtra')
  const [landHa, setLandHa] = useState('1.5')
  const [incomeInr, setIncomeInr] = useState('180000')
  const [age, setAge] = useState('34')
  const [checking, setChecking] = useState(false)
  const [eligibilityResult, setEligibilityResult] = useState<BackendEligibilityResult | null>(null)

  const filtered = useMemo(
    () => schemeService.filter(schemes, { query, category, state }),
    [schemes, query, category, state],
  )

  const toggleSave = (scheme: Scheme) => {
    const saved = savedSchemeIds.includes(scheme.id)
    if (saved) {
      unsaveScheme(scheme.id)
      show('Scheme removed', `${scheme.name} removed from saved schemes.`, 'info')
    } else {
      saveScheme(scheme.id)
      show('Scheme saved', `${scheme.name} added to your saved list.`, 'success')
    }
  }

  const start = (scheme: Scheme) => {
    startApplication(scheme.id, 'farmer-001')
    show('Demo tracker started', `Track sample application steps for ${scheme.name}.`, 'success')
  }

  const advance = (applicationId: string) => {
    advanceApplication(applicationId)
    show('Progress updated', 'Demo application moved to the next stage.', 'success')
  }

  const runEligibilityCheck = async () => {
    if (!selected) return
    setChecking(true)
    try {
      const res = await checkSchemeEligibility(selected.id, {
        state: profileState.trim() || undefined,
        landHoldingHa: landHa ? Number(landHa) : undefined,
        annualIncomeINR: incomeInr ? Number(incomeInr) : undefined,
        age: age ? Number(age) : undefined,
      })
      setEligibilityResult(res)
      show('Eligibility checked', `Result: ${res.outcome.replace(/_/g, ' ')}`, 'info')
    } catch (err) {
      show('Eligibility check failed', err instanceof Error ? err.message : 'Unable to reach backend.', 'critical')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Module 05 · Government support"
        title="SchemeSaathi"
        description="Discover sample agriculture scheme entries, inspect document checklists and track a demo application."
        badge={<DemoNote label="Sample scheme information" />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Available entries', value: schemes.length, detail: 'Illustrative scheme records' },
          { label: 'Saved schemes', value: savedSchemeIds.length, detail: 'Saved in this session' },
          { label: 'Application trackers', value: applications.length, detail: 'No submissions are made' },
        ].map((item) => (
          <Card key={item.label}>
            <p className="text-[11px] font-extrabold tracking-[0.08em] text-muted uppercase">{item.label}</p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{item.value}</p>
            <p className="mt-1 text-xs text-muted">{item.detail}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <FilterBar
          search={query}
          onSearch={setQuery}
          placeholder="Search schemes or tags…"
          selects={[
            { label: 'Category', value: category, onChange: setCategory, options: [{ value: 'All categories', label: 'All categories' }, ...SCHEME_CATEGORIES.map((name) => ({ value: name, label: name }))] },
            { label: 'State', value: state, onChange: setState, options: [{ value: 'All states', label: 'All states' }, ...SCHEME_STATES.map((name) => ({ value: name, label: name }))] },
          ]}
          onReset={() => { setQuery(''); setCategory('All categories'); setState('All states') }}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((scheme) => {
            const saved = savedSchemeIds.includes(scheme.id)
            const application = applications.find((item) => item.schemeId === scheme.id)
            return (
              <Card key={scheme.id} interactive className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-soft-sage text-forest"><Landmark size={20} /></span>
                  <button
                    type="button"
                    onClick={() => toggleSave(scheme)}
                    aria-label={saved ? 'Unsave scheme' : 'Save scheme'}
                    className={`flex size-9 items-center justify-center rounded-xl transition-colors ${saved ? 'bg-forest text-white' : 'bg-soft-sage text-forest'}`}
                  >
                    {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  </button>
                </div>
                <h2 className="mt-5 text-lg font-extrabold tracking-tight text-ink">{scheme.name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="sage">{scheme.category}</Badge>
                  <Badge tone="neutral">{scheme.state}</Badge>
                </div>
                <p className="mt-3 flex-1 text-xs leading-relaxed text-muted">{scheme.summary}</p>
                {application ? (
                  <div className="mt-4 rounded-2xl bg-soft-sage/45 p-3">
                    <Progress value={application.progress} label={application.stage} />
                  </div>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setSelected(scheme); setEligibilityResult(null) }}>View details</Button>
                  {application ? (
                    <Button size="sm" variant="secondary" onClick={() => advance(application.id)} disabled={application.progress >= 100}>
                      {application.progress >= 100 ? 'Demo submitted' : 'Advance step'}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => start(scheme)}>Start tracker</Button>
                  )}
                </div>
              </Card>
            )
          })}
          {filtered.length === 0 ? (
            <Card className="md:col-span-2 py-14 text-center">
              <Search size={28} className="mx-auto text-forest" />
              <p className="mt-3 text-sm font-bold text-ink">No scheme entries match.</p>
              <p className="mt-1 text-xs text-muted">Try clearing a filter or searching a different term.</p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Application tracker" description="Demo progress only — nothing is submitted." icon={<CheckCircle2 size={18} />} />
            <div className="space-y-3">
              {applications.map((app) => {
                const scheme = schemes.find((item) => item.id === app.schemeId)
                return (
                  <div key={app.id} className="rounded-2xl border border-line/70 bg-white/60 p-4">
                    <p className="text-sm font-extrabold text-ink">{scheme?.name ?? app.schemeId}</p>
                    <p className="mt-1 text-[11px] text-muted">Updated {formatDate(app.updatedAt)}</p>
                    <div className="mt-4"><Progress value={app.progress} label={app.stage} /></div>
                    <Button size="sm" variant="ghost" className="mt-3" onClick={() => advance(app.id)} disabled={app.progress >= 100}>
                      {app.progress >= 100 ? 'Demo complete' : 'Advance application'}
                    </Button>
                  </div>
                )
              })}
              {applications.length === 0 ? <p className="py-8 text-center text-sm text-muted">No trackers started yet.</p> : null}
            </div>
          </Card>

          <Card className="bg-forest text-white">
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-sage uppercase">Verify officially</p>
            <h3 className="mt-3 text-xl font-extrabold tracking-tight">Sample information only</h3>
            <p className="mt-3 text-xs leading-relaxed text-white/75">
              Scheme summaries and checklists are illustrative. KRISHI360 AI does not publish deadlines, benefit amounts or eligibility guarantees. Always confirm on an official government source.
            </p>
            <a href="https://www.india.gov.in/" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white/12 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20">
              Official information portal <ExternalLink size={14} />
            </a>
          </Card>
        </div>
      </div>

      <Modal open={selected !== null} onClose={() => { setSelected(null); setEligibilityResult(null) }} title={selected?.name ?? 'Scheme details'} description="Sample scheme entry with backend eligibility checker." size="lg">
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone="sage">{selected.category}</Badge>
              <Badge tone="neutral">{selected.state}</Badge>
            </div>
            <p className="text-sm leading-relaxed text-ink">{selected.summary}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-soft-sage/45 p-4">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-ink"><CheckCircle2 size={16} /> Eligibility overview</h3>
                <ul className="mt-3 space-y-2 text-xs text-muted">
                  {selected.eligibility.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
              <div className="rounded-2xl bg-soft-sage/45 p-4">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-ink"><FileText size={16} /> Document checklist</h3>
                <ul className="mt-3 space-y-2 text-xs text-muted">
                  {selected.documents.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-line/70 bg-white/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-extrabold tracking-wide text-ink uppercase">Quick eligibility check</p>
                <Button size="sm" onClick={() => void runEligibilityCheck()} disabled={checking}>
                  {checking ? 'Checking…' : 'Check eligibility'}
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <Field label="State">
                  <Input value={profileState} onChange={(e) => setProfileState(e.target.value)} />
                </Field>
                <Field label="Land (ha)">
                  <Input type="number" step="0.1" min="0" value={landHa} onChange={(e) => setLandHa(e.target.value)} />
                </Field>
                <Field label="Income (₹)">
                  <Input type="number" min="0" value={incomeInr} onChange={(e) => setIncomeInr(e.target.value)} />
                </Field>
                <Field label="Age">
                  <Input type="number" min="18" max="120" value={age} onChange={(e) => setAge(e.target.value)} />
                </Field>
              </div>
              {eligibilityResult ? (
                <div className="mt-4 space-y-2 rounded-2xl bg-soft-sage/45 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">Indicative outcome</span>
                    <Badge tone={eligibilityResult.outcome === 'likely_eligible' ? 'success' : eligibilityResult.outcome === 'likely_not_eligible' ? 'critical' : 'warning'}>
                      {eligibilityResult.outcome.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {eligibilityResult.criteria.map((criterion) => (
                      <div key={criterion.description} className="flex items-center justify-between gap-2 text-xs text-muted">
                        <span>{criterion.description}</span>
                        <Badge tone={criterion.result === 'met' ? 'success' : criterion.result === 'not_met' ? 'critical' : 'neutral'}>
                          {criterion.result}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <p className="pt-1 text-[10px] leading-relaxed text-muted">{eligibilityResult.disclaimer}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-line/70 p-4">
              <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">Official source field</p>
              <p className="mt-2 text-sm font-bold text-ink">{selected.sourceLabel}</p>
              <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-extrabold text-forest hover:underline">
                Open source <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="flex justify-end"><Button variant="outline" onClick={() => { setSelected(null); setEligibilityResult(null) }}>Close</Button></div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
