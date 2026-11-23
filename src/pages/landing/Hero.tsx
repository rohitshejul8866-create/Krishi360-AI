import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDownRight, ArrowRight, CheckCircle2, ScanSearch, Sprout, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LineReveal } from '../../components/animations/LineReveal'
import { Reveal } from '../../components/animations/Reveal'
import { DemoNote } from '../../components/common/DemoNote'
import { buttonClasses } from '../../components/ui/Button'

function FloatingCard({
  className,
  icon,
  label,
  value,
  detail,
}: {
  className: string
  icon: ReactNode
  label: string
  value: string
  detail: string
  delay: number
}) {
  return (
    <div className={`glass-panel absolute rounded-2xl px-4 py-3 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-soft-sage text-forest">{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-extrabold tracking-[0.1em] text-muted uppercase">{label}</p>
          <p className="text-lg leading-tight font-extrabold tracking-tight text-ink">{value}</p>
          <p className="truncate text-[10px] text-muted">{detail}</p>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  useReducedMotion()

  return (
    <section id="hero" className="relative overflow-hidden pt-22 pb-8 sm:pt-26 sm:pb-10">
      <div className="pointer-events-none absolute top-20 -left-40 size-[30rem] rounded-full bg-sage/15 blur-[100px]" />
      <div className="pointer-events-none absolute right-0 bottom-0 size-[26rem] rounded-full bg-soft-sage blur-[90px]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div>
          <Reveal immediate>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-sage/50 bg-white/70 px-4 py-2 text-[11px] font-extrabold tracking-[0.1em] text-forest uppercase">
                <span className="size-2 rounded-full bg-sage" />
                Built for Indian agriculture
              </span>
            </div>
          </Reveal>

          <LineReveal
            immediate
            lines={['Smarter Farming.', 'Better Decisions.']}
            as="h1"
            className="text-[2.7rem] leading-[1.06] font-extrabold tracking-[-0.055em] text-ink sm:text-6xl lg:text-[4.2rem]"
          />
          <LineReveal
            immediate
            lines={['Stronger Futures.']}
            as="p"
            delay={0.14}
            className="text-[2.7rem] leading-[1.06] font-extrabold tracking-[-0.055em] text-forest sm:text-6xl lg:text-[4.2rem]"
          />

          <Reveal immediate delay={0.2}>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              One intelligent platform connecting crop health, irrigation, storage, market
              intelligence and government support for Indian farmers.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register" className={buttonClasses('primary', 'lg')}>
                Farmer Registration <ArrowRight size={17} />
              </Link>
              <Link to="/login" className={buttonClasses('outline', 'lg')}>
                Farmer Sign In <ArrowDownRight size={17} />
              </Link>
              <Link to="/admin/login" className={buttonClasses('ghost', 'lg')}>
                Admin & Expert Login
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-semibold text-muted">
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-forest" /> Five connected modules</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-forest" /> Direct Expert & Admin login</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-forest" /> AWS DynamoDB ready</span>
            </div>
          </Reveal>
        </div>

        <Reveal immediate delay={0.12} className="relative">
          <div className="relative mx-auto max-w-[620px]">
            <div className="overflow-hidden rounded-[38px] border border-white/80 bg-white/50 p-2 shadow-[0_45px_90px_-50px_rgba(38,51,40,0.6)] backdrop-blur-xl">
              <img
                src="/hero-farm.svg"
                alt="Stylised terraced farmland with a transparent agricultural data panel"
                className="h-[340px] w-full rounded-[30px] object-cover sm:h-[420px]"
              />
            </div>
            <FloatingCard
              className="top-6 -left-2 sm:-left-8"
              icon={<ScanSearch size={18} />}
              label="CropDoctor AI"
              value="Possible blight"
              detail="Demo analysis · 78%"
              delay={0.5}
            />
            <FloatingCard
              className="top-[42%] -right-1 sm:-right-8"
              icon={<TrendingUp size={18} />}
              label="MandiSmart"
              value="₹1,840 / qtl"
              detail="Sample modal price"
              delay={0.65}
            />
            <motion.div
              className="glass-panel absolute -bottom-4 left-4 rounded-2xl px-4 py-3 sm:left-10"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-forest text-white"><Sprout size={17} /></span>
                <div>
                  <p className="text-[10px] font-extrabold tracking-[0.1em] text-muted uppercase">Connected context</p>
                  <p className="text-sm font-extrabold text-ink">One farm. Five workflows.</p>
                </div>
              </div>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
