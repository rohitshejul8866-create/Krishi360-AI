import type { ReactNode } from 'react'
import { ArrowLeft, CheckCircle2, Leaf, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '../../components/common/Brand'

export function AuthShell({
  eyebrow,
  title,
  description,
  badgeText = 'KRISHI360 Account',
  children,
  footer,
}: {
  eyebrow: string
  title: string
  description: string
  badgeText?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-screen px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[32px] border border-white/80 bg-white/55 shadow-[0_45px_100px_-60px_rgba(38,51,40,0.6)] backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-dark relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -top-24 -left-24 size-80 rounded-full bg-sage/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-0 size-80 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <Brand inverse />
            <div className="mt-20">
              <p className="text-[11px] font-extrabold tracking-[0.16em] text-sage uppercase">From seed to sale</p>
              <h2 className="mt-4 max-w-md text-4xl leading-[1.12] font-extrabold tracking-[-0.05em]">
                One intelligent platform for Indian farmers.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-white/70">
                Sign in with your verified credentials to access CropDoctor AI, MandiSmart, JalSense, GrainGuard and SchemeSaathi.
              </p>
            </div>
          </div>
          <div className="relative space-y-3">
            {['Crop diagnosis & expert review', 'Mandi price tracking', 'Farm irrigation & storage alerts'].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-white/80">
                <CheckCircle2 size={16} className="text-sage" />
                {item}
              </div>
            ))}
            <div className="mt-6 flex items-center gap-2 text-xs text-white/50">
              <Leaf size={13} /> Server-verified authentication & AWS DynamoDB ready
            </div>
          </div>
        </div>

        <div className="flex flex-col px-5 py-8 sm:px-12 sm:py-12">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted transition-colors hover:text-forest">
              <ArrowLeft size={14} /> Back to home
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sage/40 bg-soft-sage/70 px-3 py-1 text-[11px] font-bold text-forest">
              <ShieldCheck size={13} /> {badgeText}
            </span>
          </div>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-forest uppercase">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-ink sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-7 text-center text-xs text-muted">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
