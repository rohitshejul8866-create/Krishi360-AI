import type { ReactNode } from 'react'
import { LineReveal } from '../animations/LineReveal'
import { Reveal } from '../animations/Reveal'

export function SectionHeading({
  eyebrow,
  lines,
  description,
  action,
  align = 'left',
}: {
  eyebrow: string
  lines: string[]
  description?: string
  action?: ReactNode
  align?: 'left' | 'center'
}) {
  return (
    <div className={`mb-6 flex flex-col gap-4 ${align === 'center' ? 'items-center text-center' : 'lg:flex-row lg:items-end lg:justify-between'}`}>
      <div className={align === 'center' ? 'max-w-3xl' : 'max-w-3xl'}>
        <Reveal>
          <span className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-sage/40 bg-soft-sage/70 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.16em] text-forest uppercase">
            <span className="size-1.5 rounded-full bg-sage" />
            {eyebrow}
          </span>
        </Reveal>
        <LineReveal
          lines={lines}
          className="text-[2rem] leading-[1.1] font-extrabold tracking-[-0.05em] text-ink sm:text-[2.7rem]"
        />
        {description ? (
          <Reveal delay={0.12}>
            <p className={`mt-3 text-sm leading-relaxed text-muted sm:text-base ${align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}>
              {description}
            </p>
          </Reveal>
        ) : null}
      </div>
      {action ? <Reveal delay={0.18}>{action}</Reveal> : null}
    </div>
  )
}
