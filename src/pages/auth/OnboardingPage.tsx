import { ArrowRight, CheckCircle2, ScanSearch, Sprout, Store, Warehouse } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Brand } from '../../components/common/Brand'
import { DemoNote } from '../../components/common/DemoNote'

const steps = [
  { icon: Sprout, title: 'Review your profile', text: 'Confirm your demo role and location in the portal profile page.' },
  { icon: ScanSearch, title: 'Try a crop case', text: 'Upload the sample leaf and explore a labelled AI analysis result.' },
  { icon: Store, title: 'Compare a mandi', text: 'Filter sample prices and calculate a demo revenue estimate.' },
  { icon: Warehouse, title: 'Check a storage batch', text: 'Review simulated sensor values and alert history.' },
]

const homeFor = { farmer: '/farmer/dashboard', expert: '/expert/dashboard', admin: '/admin/dashboard' }

export function OnboardingPage() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Brand />
          <DemoNote label="Setup complete" />
        </div>
        <div className="glass-panel mt-12 rounded-[36px] p-6 sm:p-12">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-soft-sage px-4 py-2 text-[11px] font-extrabold tracking-[0.12em] text-forest uppercase">
              <CheckCircle2 size={14} /> Demo profile ready
            </span>
            <h1 className="mt-6 text-4xl leading-tight font-extrabold tracking-[-0.05em] text-ink sm:text-5xl">
              Welcome, {user.name.split(' ')[0]}.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
              Your {user.role} workspace is ready. Here are four useful things to try first in this frontend-only demonstration.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={step.title} className="clay-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-soft-sage text-forest"><Icon size={18} /></span>
                    <span className="text-[11px] font-extrabold text-muted">0{index + 1}</span>
                  </div>
                  <h2 className="mt-4 text-sm font-extrabold text-ink">{step.title}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{step.text}</p>
                </div>
              )
            })}
          </div>
          <Link
            to={homeFor[user.role]}
            className="mt-10 inline-flex items-center gap-2 rounded-2xl bg-forest px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#2b402c]"
          >
            Enter {user.role} portal <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
