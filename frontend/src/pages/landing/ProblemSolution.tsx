import { ArrowRight, CloudRain, Landmark, Search, Store, Thermometer, TriangleAlert } from 'lucide-react'
import { Reveal } from '../../components/animations/Reveal'
import { SectionHeading } from '../../components/common/SectionHeading'
import { Stagger, StaggerItem } from '../../components/animations/Stagger'

const problems = [
  { icon: TriangleAlert, title: 'Crop health uncertainty', text: 'Symptoms appear before a farmer knows what to check or whom to ask.' },
  { icon: Store, title: 'Unclear market prices', text: 'Mandi information is scattered across sources with little comparison.' },
  { icon: CloudRain, title: 'Irrigation decisions', text: 'Water scheduling often depends on guesswork rather than field context.' },
  { icon: Thermometer, title: 'Storage monitoring gaps', text: 'Stored produce can deteriorate before conditions are reviewed.' },
  { icon: Landmark, title: 'Scheme discovery complexity', text: 'Relevant government support is difficult to find and interpret.' },
]

export function ProblemSolution() {
  return (
    <section id="platform" className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="The problem & our solution"
          lines={['One farm. Many disconnected answers.', 'KRISHI360 AI brings them together.']}
          description="Farmers rarely face one challenge at a time. A crop health question affects irrigation, storage, market timing and the support they may be eligible for."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Stagger className="grid gap-4 sm:grid-cols-2">
            {problems.map((problem) => {
              const Icon = problem.icon
              return (
                <StaggerItem key={problem.title}>
                  <div className="clay-card h-full p-5">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-[#FBE7E3] text-alert">
                      <Icon size={18} />
                    </span>
                    <h3 className="mt-4 text-sm font-extrabold text-ink">{problem.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{problem.text}</p>
                  </div>
                </StaggerItem>
              )
            })}
            <StaggerItem className="sm:col-span-2">
              <div className="flex h-full items-center gap-4 rounded-[24px] border border-dashed border-sage/60 bg-soft-sage/35 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-forest text-white"><Search size={19} /></span>
                <p className="text-sm font-semibold text-forest">The result: critical context is fragmented across tools, documents and sources.</p>
              </div>
            </StaggerItem>
          </Stagger>

          <Reveal delay={0.15}>
            <div className="glass-panel relative h-full overflow-hidden rounded-[32px] p-6 sm:p-8">
              <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-sage/25 blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-extrabold tracking-[0.14em] text-forest uppercase">Unified workspace</p>
                    <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">Shared farm context</h3>
                  </div>
                  <span className="rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-bold text-forest">Demo view</span>
                </div>

                <div className="mt-8 space-y-3">
                  {[
                    { label: 'CropDoctor AI', value: 'Image + symptoms', dot: 'bg-sage' },
                    { label: 'JalSense', value: 'Moisture + weather', dot: 'bg-forest' },
                    { label: 'GrainGuard', value: 'Temperature + humidity', dot: 'bg-sage' },
                    { label: 'MandiSmart', value: 'Crop + location', dot: 'bg-forest' },
                    { label: 'SchemeSaathi', value: 'Profile + interests', dot: 'bg-sage' },
                  ].map((row, index) => (
                    <div key={row.label} className="flex items-center gap-4 rounded-2xl bg-white/65 px-4 py-3.5">
                      <span className={`size-2.5 rounded-full ${row.dot}`} />
                      <p className="flex-1 text-sm font-bold text-ink">{row.label}</p>
                      <p className="text-xs text-muted">{row.value}</p>
                      <span className="text-[10px] font-bold text-muted">0{index + 1}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-7 flex items-center gap-3 rounded-2xl bg-forest px-5 py-4 text-white">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-white/12"><ArrowRight size={17} /></span>
                  <p className="text-sm font-semibold">One profile. One crop history. Clearer next steps.</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
