import { FlaskConical } from 'lucide-react'

export function DemoNote({ label = 'Demo data', className = '' }: { label?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-sage/40 bg-soft-sage/70 px-2.5 py-1 text-[10px] font-extrabold tracking-[0.08em] text-forest uppercase ${className}`}
    >
      <FlaskConical size={12} />
      {label}
    </span>
  )
}
