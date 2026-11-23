import { ArrowUpRight, Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useToast } from '../../context/ToastContext'
import { Brand } from '../common/Brand'

const moduleLinks = [
  { label: 'CropDoctor AI', to: '/farmer/crop-doctor' },
  { label: 'MandiSmart', to: '/farmer/mandi-smart' },
  { label: 'JalSense', to: '/farmer/jal-sense' },
  { label: 'GrainGuard', to: '/farmer/grain-guard' },
  { label: 'SchemeSaathi', to: '/farmer/scheme-saathi' },
]

const farmerLinks = [
  { label: 'Farmer dashboard', to: '/farmer/dashboard' },
  { label: 'My farm', to: '/farmer/my-farm' },
  { label: 'My crops', to: '/farmer/my-crops' },
  { label: 'AI assistant', to: '/farmer/assistant' },
  { label: 'Notifications', to: '/farmer/notifications' },
]

const expertLinks = [
  { label: 'Expert dashboard', to: '/expert/dashboard' },
  { label: 'Assigned cases', to: '/expert/cases' },
  { label: 'AI analysis review', to: '/expert/ai-review' },
  { label: 'Case history', to: '/expert/history' },
  { label: 'Expert profile', to: '/expert/profile' },
]

export function Footer() {
  const { show } = useToast()

  return (
    <footer className="px-3 pb-5 sm:px-6">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[36px] border border-white/70 bg-linear-to-br from-soft-sage/80 via-[#F1F4E9]/85 to-sage/35 p-6 shadow-[0_40px_90px_-50px_rgba(38,51,40,0.55)] backdrop-blur-2xl sm:p-10">
        <div className="pointer-events-none absolute -top-24 -left-20 size-72 rounded-full bg-white/60 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 size-80 rounded-full bg-sage/35 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 size-52 -translate-x-1/2 rounded-full bg-forest/10 blur-3xl" />

        <div className="relative">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div className="max-w-sm">
              <div className="rounded-2xl bg-white/55 p-3 inline-block">
                <Brand />
              </div>
              <p className="mt-5 text-sm leading-relaxed text-ink/80">
                From Seed to Sale — one intelligent platform for Indian farmers. Five connected
                modules, three role-specific workspaces, one clear demo experience.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-[11px] font-bold text-forest">
                  Frontend demo
                </span>
                <span className="rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-[11px] font-bold text-forest">
                  Simulated data
                </span>
              </div>
            </div>

            <FooterColumn title="Five modules" links={moduleLinks} />
            <FooterColumn title="Farmer resources" links={farmerLinks} />
            <FooterColumn title="Expert resources" links={expertLinks} />
            <div>
              <h3 className="mb-4 text-[11px] font-extrabold tracking-[0.14em] text-forest uppercase">About</h3>
              <div className="space-y-2.5 text-sm">
                <button
                  type="button"
                  onClick={() => show('About this demo', 'Built as a frontend-only hackathon experience. No live services are connected.', 'info')}
                  className="block text-left text-ink/75 transition-colors hover:text-forest"
                >
                  About KRISHI360 AI
                </button>
                <a href="mailto:hello@krishi360.demo" className="block text-ink/75 transition-colors hover:text-forest">
                  Contact
                </a>
                <button
                  type="button"
                  onClick={() => show('Privacy note (demo)', 'This frontend stores only your demo role in session storage. No farm data is transmitted.', 'info')}
                  className="block text-left text-ink/75 transition-colors hover:text-forest"
                >
                  Privacy
                </button>
                <button
                  type="button"
                  onClick={() => show('Terms note (demo)', 'Sample data, simulated AI results and demo prices are illustrative only.', 'info')}
                  className="block text-left text-ink/75 transition-colors hover:text-forest"
                >
                  Terms
                </button>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-white/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">© 2026 KRISHI360 AI · Demo frontend · Techfest, IIT Bombay</p>
            <a
              href="#hero"
              className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/60 px-4 py-2 text-xs font-bold text-forest transition-colors hover:bg-white"
            >
              Back to top <ArrowUpRight size={13} />
            </a>
          </div>

          <div className="mt-6 flex items-center gap-2 text-[11px] text-muted">
            <Leaf size={13} className="text-forest" />
            AI outputs, market prices and sensor readings in this application are clearly labelled simulations.
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h3 className="mb-4 text-[11px] font-extrabold tracking-[0.14em] text-forest uppercase">{title}</h3>
      <div className="space-y-2.5 text-sm">
        {links.map((link) => (
          <Link key={link.label} to={link.to} className="block text-ink/75 transition-colors hover:text-forest">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
