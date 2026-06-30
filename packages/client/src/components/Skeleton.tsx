export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: 'var(--c-border)', opacity: 0.5 }}
    />
  )
}

export function KpiSkeleton() {
  return (
    <div className="glass-card rounded-xl p-4">
      <Skeleton className="mb-2 h-3 w-16" />
      <Skeleton className="h-7 w-24" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="glass-card rounded-xl p-6">
      <Skeleton className="mb-6 h-5 w-32" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div className="glass-card rounded-xl">
      <div className="border-b p-4" style={{ borderColor: 'var(--c-border)' }}>
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  )
}
