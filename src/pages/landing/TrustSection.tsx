import { Bot, FileCheck2, Fingerprint, LockKeyhole, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { Reveal } from '../../components/animations/Reveal'
import { SectionHeading } from '../../components/common/SectionHeading'

const principles = [
  {
    icon: Bot,
    title: 'Assistance, not diagnosis',
    text: 'AI outputs are labelled simulations and are not presented as guaranteed agricultural diagnoses.',
  },
  {
    icon: UserRoundCheck,
    title: 'Human expert review',
    text: 'Crop cases can move to an agriculture expert who records observations and safe next-step guidance.',
  },
  {
    icon: Fingerprint,
    title: 'Privacy-conscious design',
    text: 'The demo keeps data in the browser session and only stores the selected demo role in session storage.',
  },
  {
    icon: LockKeyhole,
    title: 'Role-based access concept',
    text: 'Farmer, expert and admin navigations are separated to demonstrate least-privilege access patterns.',
  },
  {
    icon: FileCheck2,
    title: 'Source transparency',
    text: 'Mandi records, scheme entries and sensor readings show clear demo-source labels instead of implying live feeds.',
  },
]

export function TrustSection() {
  return (
    <section id="trust" className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Responsible AI & security"
          lines={['Useful guidance starts', 'with honest boundaries.']}
          description="This frontend deliberately avoids claims of live connectivity, certified security or guaranteed outcomes. The design prepares for those capabilities without pretending they exist."
        />

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {principles.map((principle, index) => {
              const Icon = principle.icon
              return (
                <Reveal key={principle.title} delay={index * 0.07}>
                  <div className="clay-card h-full p-5">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-soft-sage text-forest">
                      <Icon size={18} />
                    </span>
                    <h3 className="mt-4 text-sm font-extrabold text-ink">{principle.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{principle.text}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>

          <Reveal delay={0.16}>
            <div className="glass-dark relative flex h-full min-h-80 flex-col justify-between overflow-hidden rounded-[32px] p-7 text-white">
              <div className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-sage/25 blur-3xl" />
              <div className="relative">
                <ShieldCheck size={28} className="text-sage" />
                <p className="mt-6 text-[11px] font-extrabold tracking-[0.14em] text-sage uppercase">Demo boundary</p>
                <h3 className="mt-3 text-2xl font-extrabold tracking-tight">What this build does not claim</h3>
              </div>
              <ul className="relative mt-8 space-y-3 text-sm text-white/75">
                <li className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-sage" /> No live AI, sensor or mandi API integration.</li>
                <li className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-sage" /> No security certification or audit claim.</li>
                <li className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-sage" /> No verified government deadlines or benefits.</li>
                <li className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-sage" /> No unsafe chemical or dosage advice.</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
