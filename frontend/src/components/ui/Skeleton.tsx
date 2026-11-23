export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-soft-sage/70 ${className}`} />
}

export function LoadingBlock({ label = 'Preparing your demo…' }: { label?: string }) {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <span className="size-3 animate-pulse rounded-full bg-sage" />
        <p className="text-sm font-semibold text-muted">{label}</p>
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  )
}
