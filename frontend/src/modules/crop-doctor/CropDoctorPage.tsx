import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  FileImage,
  ImagePlus,
  Info,
  Loader2,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { DemoNote } from '../../components/common/DemoNote'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Input'
import { Progress } from '../../components/ui/Progress'
import { Tabs } from '../../components/ui/Tabs'
import { Modal } from '../../components/ui/Modal'
import { LoadingBlock } from '../../components/ui/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../services/store'
import { cropDoctorService } from '../../services/cropDoctorService'
import { CROP_NAMES, PLANT_PARTS } from '../../data/crops'
import { formatDate, relativeTime } from '../../services/utils'
import type { AnalysisResult, CropCase } from '../../types'

type Step = 'form' | 'analyzing' | 'result'

export function CropDoctorPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState('new')
  const [step, setStep] = useState<Step>('form')
  const [imageUrl, setImageUrl] = useState('')
  const [imageName, setImageName] = useState('')
  const [crop, setCrop] = useState(CROP_NAMES[0])
  const [plantPart, setPlantPart] = useState(PLANT_PARTS[0])
  const [location, setLocation] = useState('Nashik, Maharashtra')
  const [symptoms, setSymptoms] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [latestCase, setLatestCase] = useState<CropCase | null>(null)
  const [selectedCase, setSelectedCase] = useState<CropCase | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const { show } = useToast()
  const { user } = useAuth()
  const { cases, addCase, notify } = useApp()

  const farmerCases = cases.filter((item) => item.farmerId === (user?.id ?? 'farmer-001') || item.farmerName === user?.name)

  const loadFile = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be smaller than 8 MB in this demo.')
      return
    }
    setError('')
    setImageUrl(URL.createObjectURL(file))
    setImageName(file.name)
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => loadFile(event.target.files?.[0])

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    loadFile(event.dataTransfer.files?.[0])
  }

  const useSample = () => {
    setImageUrl('/sample-leaf.svg')
    setImageName('sample-leaf.svg')
    setError('')
    setSymptoms('Dark circular spots with a yellow halo on older leaves.')
    setCrop('Tomato')
    show('Sample image loaded', 'You can now run a demo analysis.', 'info')
  }

  const reset = () => {
    setStep('form')
    setResult(null)
    setLatestCase(null)
    setImageUrl('')
    setImageName('')
    setSymptoms('')
  }

  const analyze = async (event: FormEvent) => {
    event.preventDefault()
    if (!imageUrl) {
      setError('Upload an image or use the sample image first.')
      return
    }
    setError('')
    setStep('analyzing')
    const input = { crop, plantPart, location, symptoms, imageUrl, imageName: imageName || 'uploaded-image' }
    try {
      const { cropCase, analysis } = await cropDoctorService.analyzeWithBackend(input)
      addCase(cropCase)
      notify({
        title: 'Crop case submitted',
        body: `${cropCase.id} was saved and added to the expert review queue.`,
        severity: 'info',
        audience: 'expert',
      })
      setResult(analysis)
      setLatestCase(cropCase)
      setStep('result')
      show('Analysis complete', `${cropCase.id} saved via backend API.`, 'success')
    } catch (err) {
      setStep('form')
      const message = err instanceof Error ? err.message : 'Unable to submit case to backend.'
      setError(message)
      show('Analysis failed', message, 'critical')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Module 01 · Crop health"
        title="CropDoctor AI"
        description="Explore possible crop conditions from an image and symptoms, with safe plain-language next steps."
        badge={<DemoNote label="Simulated AI analysis" />}
        actions={<Button variant="outline" onClick={() => setTab('history')}><ScanSearch size={15} /> Case history</Button>}
      />

      <Tabs
        items={[
          { id: 'new', label: 'New analysis' },
          { id: 'history', label: `Case history (${farmerCases.length})` },
        ]}
        activeId={tab}
        onChange={setTab}
        className="mb-6 max-w-md"
      />

      {tab === 'new' ? (
        step === 'analyzing' ? (
          <Card className="mx-auto max-w-3xl py-12">
            <LoadingBlock label="Comparing sample visual patterns…" />
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {['Reading crop context', 'Comparing reference patterns', 'Preparing plain-language guidance'].map((item, index) => (
                <div key={item} className="flex items-center gap-2 rounded-2xl bg-soft-sage/45 px-3 py-3 text-xs font-semibold text-forest">
                  <Loader2 size={14} className="animate-spin" style={{ animationDelay: `${index * 150}ms` }} />
                  {item}
                </div>
              ))}
            </div>
          </Card>
        ) : step === 'result' && result && latestCase ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#F3C4BC] bg-[#FBE7E3] px-5 py-4">
              <div className="flex items-start gap-3">
                <Info size={18} className="mt-0.5 shrink-0 text-alert" />
                <div>
                  <p className="text-sm font-extrabold text-alert">Demo AI analysis — not a verified agricultural diagnosis.</p>
                  <p className="mt-1 text-xs text-ink/70">Do not apply any chemical treatment based on this result alone. Confirm with a qualified local expert.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={reset}>New analysis</Button>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge tone="sage">{latestCase.id}</Badge>
                    <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{result.condition}</h2>
                    <p className="mt-2 text-sm text-muted">{latestCase.crop} · {latestCase.plantPart} · {latestCase.location}</p>
                  </div>
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-soft-sage text-forest"><Sparkles size={22} /></span>
                </div>
                <div className="mt-7 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
                  <div className="rounded-2xl bg-soft-sage/50 p-5 text-center">
                    <p className="text-4xl font-extrabold tracking-tight text-forest">{result.confidence}%</p>
                    <p className="mt-1 text-[11px] font-bold text-muted">Demo confidence</p>
                  </div>
                  <div>
                    <Progress value={result.confidence} label="Pattern similarity (simulated)" />
                    <p className="mt-3 text-xs leading-relaxed text-muted">{result.explanation}</p>
                  </div>
                </div>

                <div className="mt-7">
                  <h3 className="text-sm font-extrabold text-ink">Alternative possibilities</h3>
                  <div className="mt-3 space-y-2">
                    {result.alternatives.map((alternative) => (
                      <div key={alternative.name} className="flex items-center justify-between gap-3 rounded-2xl border border-line/70 px-4 py-3 text-sm">
                        <span className="font-semibold text-ink">{alternative.name}</span>
                        <span className="text-xs font-bold text-muted">{alternative.confidence}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-7">
                  <h3 className="text-sm font-extrabold text-ink">Observed symptoms</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.observedSymptoms.map((symptom) => <Badge key={symptom} tone="neutral">{symptom}</Badge>)}
                  </div>
                </div>
              </Card>

              <div className="space-y-5">
                <Card>
                  <CardHeader title="Analyzed image" description="Preview of the submitted sample." icon={<FileImage size={18} />} />
                  <img src={latestCase.imageUrl} alt="Submitted crop sample used for demo analysis" className="aspect-[4/3] w-full rounded-2xl border border-line object-cover" />
                  <p className="mt-3 text-[11px] text-muted">File: {imageName || 'sample'}</p>
                </Card>
                <Card>
                  <CardHeader title="Safe next steps" description="Non-chemical, observational guidance only." icon={<ShieldCheck size={18} />} />
                  <ol className="space-y-3">
                    {result.nextSteps.map((stepText, index) => (
                      <li key={stepText} className="flex gap-3 text-sm text-ink">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-soft-sage text-[11px] font-extrabold text-forest">{index + 1}</span>
                        {stepText}
                      </li>
                    ))}
                  </ol>
                  {result.recommendExpert ? (
                    <Button className="mt-6 w-full" variant="outline" onClick={() => setTab('history')}>
                      Queued for Expert review · View Case History <ArrowRight size={15} />
                    </Button>
                  ) : null}
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader title="Submit a crop observation" description="Upload, describe and analyse a sample image." icon={<UploadCloud size={18} />} />
              <form onSubmit={(event) => void analyze(event)} className="space-y-5">
                <div
                  onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`relative rounded-[24px] border-2 border-dashed p-5 text-center transition-colors ${dragging ? 'border-forest bg-soft-sage' : 'border-sage/50 bg-soft-sage/25'}`}
                >
                  <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" aria-label="Upload crop image" />
                  {imageUrl ? (
                    <div className="relative mx-auto max-w-md">
                      <img src={imageUrl} alt="Crop image preview" className="aspect-[4/3] w-full rounded-2xl border border-line object-cover" />
                      <button type="button" onClick={() => { setImageUrl(''); setImageName('') }} className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-white/90 text-alert" aria-label="Remove image"><Trash2 size={15} /></button>
                    </div>
                  ) : (
                    <>
                      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-forest"><ImagePlus size={22} /></span>
                      <p className="mt-4 text-sm font-extrabold text-ink">Drag and drop a crop image</p>
                      <p className="mt-1 text-xs text-muted">PNG or JPG up to 8 MB · Stays in your browser</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Browse image</Button>
                        <Button type="button" variant="secondary" size="sm" onClick={useSample}>Use sample image</Button>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Crop" required>
                    <Select value={crop} onChange={(event) => setCrop(event.target.value)} options={CROP_NAMES.map((name) => ({ value: name, label: name }))} />
                  </Field>
                  <Field label="Plant part" required>
                    <Select value={plantPart} onChange={(event) => setPlantPart(event.target.value)} options={PLANT_PARTS.map((part) => ({ value: part, label: part }))} />
                  </Field>
                </div>
                <Field label="Location" required>
                  <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="District, State" />
                </Field>
                <Field label="Optional symptoms" hint="Describe what you see for a more contextual demo result.">
                  <Textarea value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="e.g. Brown spots with yellow edges on older leaves" />
                </Field>
                {error ? <p className="rounded-2xl bg-[#FBE7E3] px-4 py-3 text-xs font-semibold text-alert">{error}</p> : null}
                <Button type="submit" size="lg" className="w-full"><Sparkles size={17} /> Run demo analysis</Button>
              </form>
            </Card>

            <div className="space-y-5">
              <Card className="bg-forest text-white">
                <p className="text-[11px] font-extrabold tracking-[0.14em] text-sage uppercase">How this demo works</p>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight">Structured observation, honest output.</h2>
                <div className="mt-6 space-y-4">
                  {[
                    { icon: ImagePlus, text: 'Add a clear image and crop context.' },
                    { icon: Sparkles, text: 'Compare against broad sample patterns.' },
                    { icon: CheckCircle2, text: 'Receive labelled possibilities and safe steps.' },
                  ].map((item) => {
                    const Icon = item.icon
                    return <div key={item.text} className="flex items-center gap-3 text-sm text-white/80"><Icon size={16} className="text-sage" />{item.text}</div>
                  })}
                </div>
              </Card>
              <Card>
                <CardHeader title="Before you begin" description="Important boundaries for this module." icon={<Info size={18} />} />
                <ul className="space-y-3 text-xs leading-relaxed text-muted">
                  <li>• Case submissions and pattern analysis run on the connected backend API.</li>
                  <li>• Confidence values are illustrative pattern-similarity numbers.</li>
                  <li>• No pesticide names, dosages or chemical instructions are provided.</li>
                  <li>• Cases are synced with the expert portal for review.</li>
                </ul>
              </Card>
            </div>
          </div>
        )
      ) : (
        <Card>
          <CardHeader title="Crop case history" description="Cases submitted in this demo session." icon={<ScanSearch size={18} />} />
          <div className="space-y-3">
            {farmerCases.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedCase(item)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/70 bg-white/60 p-4 text-left transition-colors hover:border-sage">
                <div className="flex items-center gap-3">
                  <img src={item.imageUrl} alt="" className="size-12 rounded-xl object-cover" />
                  <div>
                    <p className="text-sm font-extrabold text-ink">{item.crop} · {item.condition}</p>
                    <p className="mt-1 text-[11px] text-muted">{item.id} · {relativeTime(item.submittedAt)}</p>
                  </div>
                </div>
                <Badge tone={item.reviewStatus === 'completed' ? 'success' : 'warning'}>{item.reviewStatus}</Badge>
              </button>
            ))}
            {farmerCases.length === 0 ? <p className="py-10 text-center text-sm text-muted">No cases submitted yet.</p> : null}
          </div>
        </Card>
      )}

      <Modal open={selectedCase !== null} onClose={() => setSelectedCase(null)} title={selectedCase?.id ?? 'Case details'} description="Demo case record." size="lg">
        {selectedCase ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <img src={selectedCase.imageUrl} alt="Crop case sample" className="aspect-square w-full rounded-2xl border border-line object-cover" />
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-extrabold tracking-wide text-muted uppercase">Possible condition</p>
                  <p className="mt-1 text-lg font-extrabold text-ink">{selectedCase.condition}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-muted">Crop</p><p className="font-bold text-ink">{selectedCase.crop}</p></div>
                  <div><p className="text-muted">Confidence</p><p className="font-bold text-ink">{selectedCase.confidence}%</p></div>
                  <div><p className="text-muted">Submitted</p><p className="font-bold text-ink">{formatDate(selectedCase.submittedAt)}</p></div>
                  <div><p className="text-muted">Review</p><p className="font-bold text-ink">{selectedCase.reviewStatus}</p></div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-soft-sage/45 p-4 text-xs leading-relaxed text-ink">{selectedCase.explanation}</div>
            {selectedCase.expertGuidance ? (
              <div className="rounded-2xl border border-line/70 p-4">
                <p className="text-[10px] font-extrabold tracking-wide text-forest uppercase">Expert guidance</p>
                <p className="mt-2 text-sm text-ink">{selectedCase.expertGuidance}</p>
              </div>
            ) : null}
            <div className="flex justify-end"><Button variant="outline" onClick={() => setSelectedCase(null)}><X size={15} /> Close</Button></div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
