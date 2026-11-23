import { ArrowUpRight, ShieldCheck, Sprout, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionHeading } from '../../components/common/SectionHeading'
import { Stagger, StaggerItem } from '../../components/animations/Stagger'

const portals = [
  {
    role: 'farmer',
    title: 'Farmer Portal',
    to: '/register',
    cta: 'Farmer Registration & Login',
    icon: Sprout,
    text: 'A daily workspace for farm records, crop cases, mandi comparison, irrigation, storage, schemes and AI assistance.',
    points: ['Farm and crop dashboard', 'Five module workflows', 'Personal notifications'],
  },
  {
    role: 'expert',
    title: 'Agriculture Expert Portal',
    to: '/expert/login',
    cta: 'Direct Expert Login',
    icon: Users,
    text: 'A review workspace for assigned cases, AI findings, observations, safe guidance and case history.',
    points: ['Assigned case queue', 'AI analysis review', 'Structured feedback'],
  },
  {
    role: 'admin',
    title: 'Administrator Portal',
    to: '/admin/login',
    cta: 'Direct Admin Panel Login',
    icon: ShieldCheck,
    text: 'An operations workspace for user & expert accounts, module data, analytics, AWS database and audit logs.',
    points: ['Expert & user provisioning', 'AWS DynamoDB & backend tab', 'Audit trail and controls'],
  },
]

export function RolesShowcase() {
  return (
    <section id="roles" className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Three portals"
          lines={['Designed around every role', 'in the agriculture value chain.']}
          description="Farmers register and sign in to manage their farms, while Crop Experts and Administrators sign in directly to their review and operations panels."
        />

        <Stagger className="grid gap-5 lg:grid-cols-3">
          {portals.map((portal) => {
            const Icon = portal.icon
            return (
              <StaggerItem key={portal.role}>
                <div className="clay-card clay-card-hover flex h-full flex-col p-6 sm:p-7">
                  <div className="flex items-start justify-between">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-soft-sage text-forest">
                      <Icon size={22} />
                    </span>
                    <span className="rounded-full border border-line bg-white/70 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.1em] text-muted uppercase">
                      {portal.role}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl font-extrabold tracking-tight text-ink">{portal.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{portal.text}</p>
                  <ul className="mt-6 space-y-2.5">
                    {portal.points.map((point) => (
                      <li key={point} className="flex items-center gap-2 text-xs font-semibold text-ink">
                        <span className="size-1.5 rounded-full bg-sage" />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={portal.to}
                    className="mt-7 inline-flex items-center justify-center gap-2 rounded-2xl bg-forest px-5 py-3 text-sm font-bold text-white transition-all hover:bg-[#2b402c]"
                  >
                    {portal.cta} <ArrowUpRight size={15} />
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
