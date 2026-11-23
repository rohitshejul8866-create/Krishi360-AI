import { ArrowRight, Droplets, Landmark, ScanSearch, Store, Warehouse } from 'lucide-react'
import { Reveal } from '../../components/animations/Reveal'
import { SectionHeading } from '../../components/common/SectionHeading'

const steps = [
  { icon: ScanSearch, title: 'Observe crop health', text: 'Capture symptoms and build a case history for each crop.' },
  { icon: Droplets, title: 'Plan irrigation', text: 'Use crop stage and moisture context to plan the next watering.' },
  { icon: Warehouse, title: 'Protect storage', text: 'Watch simulated batch conditions and log inspections.' },
  { icon: Store, title: 'Compare markets', text: 'Review sample mandi prices and estimate potential returns.' },
  { icon: Landmark, title: 'Find support', text: 'Discover scheme entries and track a demo application.' },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="How it works"
          lines={['A connected journey,', 'not another disconnected app.']}
          description="The same farm and crop profile travels through every module, reducing repeated data entry and keeping decisions in context."
        />

        <div className="glass-panel relative overflow-hidden rounded-[34px] p-5 sm:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-px bg-linear-to-r from-transparent via-sage to-transparent lg:block" />
          <div className="relative grid gap-4 lg:grid-cols-5">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <Reveal key={step.title} delay={index * 0.09}>
                  <div className="clay-card h-full p-5">
                    <div className="flex items-center justify-between">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-soft-sage text-forest">
                        <Icon size={19} />
                      </span>
                      <span className="text-[11px] font-extrabold text-muted">STEP {index + 1}</span>
                    </div>
                    <h3 className="mt-5 text-sm font-extrabold text-ink">{step.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{step.text}</p>
                    {index < steps.length - 1 ? (
                      <ArrowRight size={15} className="mt-5 hidden text-sage lg:block" />
                    ) : null}
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
