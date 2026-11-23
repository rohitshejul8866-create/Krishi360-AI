import { ArrowUpRight, Droplets, MessageSquareText, ScanSearch, Store, Warehouse } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionHeading } from '../../components/common/SectionHeading'
import { Stagger, StaggerItem } from '../../components/animations/Stagger'
import { DemoNote } from '../../components/common/DemoNote'

const modules = [
  {
    name: 'CropDoctor AI',
    icon: ScanSearch,
    description: 'Upload a crop image and describe symptoms to explore possible conditions with plain-language guidance.',
    benefit: 'Earlier, structured crop-health triage',
    to: '/farmer/crop-doctor',
    index: '01',
  },
  {
    name: 'MandiSmart',
    icon: Store,
    description: 'Compare sample mandi prices, review trends and estimate potential returns before reaching the market.',
    benefit: 'Clearer market comparison',
    to: '/farmer/mandi-smart',
    index: '02',
  },
  {
    name: 'JalSense',
    icon: Droplets,
    description: 'Use crop stage, soil and moisture inputs to understand a transparent demo irrigation recommendation.',
    benefit: 'More deliberate water planning',
    to: '/farmer/jal-sense',
    index: '03',
  },
  {
    name: 'GrainGuard',
    icon: Warehouse,
    description: 'Track storage batches against configurable temperature and humidity thresholds with alert history.',
    benefit: 'Earlier storage risk visibility',
    to: '/farmer/grain-guard',
    index: '04',
  },
  {
    name: 'SchemeSaathi',
    icon: MessageSquareText,
    description: 'Discover sample scheme entries, check document checklists and track application progress.',
    benefit: 'Simpler scheme discovery',
    to: '/farmer/scheme-saathi',
    index: '05',
  },
]

export function ModulesShowcase() {
  return (
    <section id="modules" className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Five intelligent modules"
          lines={['From crop health to government support.', 'One connected product surface.']}
          description="Each module works on its own and shares the same farm context, so a decision in one workflow informs the next."
          action={<DemoNote label="Simulated results" />}
        />

        <Stagger className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module, index) => {
            const Icon = module.icon
            const featured = index === 0
            return (
              <StaggerItem key={module.name} className={featured ? 'md:col-span-2 xl:col-span-1' : ''}>
                <div className="clay-card clay-card-hover group relative flex h-full flex-col overflow-hidden p-6">
                  <div className="pointer-events-none absolute -top-14 -right-14 size-40 rounded-full bg-soft-sage/70 blur-2xl transition-transform duration-500 group-hover:scale-125" />
                  <div className="relative flex items-start justify-between">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-soft-sage text-forest">
                      <Icon size={22} />
                    </span>
                    <span className="text-xs font-extrabold tracking-[0.12em] text-muted">{module.index}</span>
                  </div>
                  <h3 className="relative mt-6 text-xl font-extrabold tracking-tight text-ink">{module.name}</h3>
                  <p className="relative mt-3 flex-1 text-sm leading-relaxed text-muted">{module.description}</p>
                  <div className="relative mt-6 rounded-2xl bg-soft-sage/60 px-4 py-3 text-xs font-bold text-forest">
                    {module.benefit}
                  </div>
                  <Link
                    to={module.to}
                    className="relative mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-forest transition-all group-hover:gap-3"
                  >
                    Explore module <ArrowUpRight size={16} />
                  </Link>
                </div>
              </StaggerItem>
            )
          })}
        </Stagger>
      </div>
    </section>
  )
}
