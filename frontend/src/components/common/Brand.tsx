import { Link } from 'react-router-dom'

export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-[14px] bg-linear-to-br from-sage to-forest shadow-[0_10px_22px_-12px_rgba(52,75,53,0.9)]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" fill="none">
        <path d="M5 25C6 13 13 6 27 5c1 14-7 23-19 23-1 0-2-1-3-3Z" fill="#F7F5EF" opacity=".96" />
        <path d="M6.5 26C12 19 18 13 26 7" stroke="#344B35" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function Brand({
  compact = false,
  to = '/',
  inverse = false,
}: {
  compact?: boolean
  to?: string
  inverse?: boolean
}) {
  return (
    <Link to={to} className="group flex items-center gap-3" aria-label="KRISHI360 AI home">
      <BrandMark />
      {compact ? null : (
        <span className="leading-none">
          <span className={`block text-[15px] font-extrabold tracking-[-0.04em] ${inverse ? 'text-white' : 'text-ink'}`}>
            KRISHI360 <span className={inverse ? 'text-sage' : 'text-forest'}>AI</span>
          </span>
          <span className={`mt-1 block text-[9px] font-bold tracking-[0.16em] uppercase ${inverse ? 'text-white/60' : 'text-muted'}`}>
            Seed to Sale Intelligence
          </span>
        </span>
      )}
    </Link>
  )
}
