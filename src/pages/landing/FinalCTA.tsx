import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Reveal } from '../../components/animations/Reveal'
import { LineReveal } from '../../components/animations/LineReveal'
import { buttonClasses } from '../../components/ui/Button'

export function FinalCTA() {
  return (
    <section className="px-4 py-6 pb-10 sm:px-6 sm:py-8 sm:pb-12">
      <Reveal>
        <div className="glass-panel relative mx-auto max-w-7xl overflow-hidden rounded-[36px] px-6 py-8 text-center sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute top-0 left-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sage/25 blur-[90px]" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-sage/40 bg-white/70 px-4 py-2 text-[11px] font-extrabold tracking-[0.12em] text-forest uppercase">
              <Sparkles size={14} /> One platform
            </span>
            <LineReveal
              lines={['Bring Your Farm Decisions Together.']}
              as="h2"
              className="mx-auto mt-7 max-w-4xl text-[2.3rem] leading-[1.08] font-extrabold tracking-[-0.05em] text-ink sm:text-5xl"
            />
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Register your farmer account or sign in directly to your Crop Expert or Administrator portal.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link to="/register" className={buttonClasses('primary', 'lg')}>
                Farmer Registration <ArrowRight size={17} />
              </Link>
              <Link to="/login" className={buttonClasses('outline', 'lg')}>
                Farmer Sign In
              </Link>
              <Link to="/admin/login" className={buttonClasses('ghost', 'lg')}>
                Admin & Expert Login
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
