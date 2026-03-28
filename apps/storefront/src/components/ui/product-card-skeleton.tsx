export function ProductCardSkeleton() {
  return (
    <div
      className="flex flex-col w-full rounded-xl overflow-hidden animate-pulse"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}
    >
      {/* Image area */}
      <div className="aspect-square w-full" style={{ background: "var(--bg-tertiary)" }} />
      {/* Card body */}
      <div className="p-3 flex flex-col gap-2">
        <div className="h-3 w-16 rounded" style={{ background: "var(--bg-tertiary)" }} />
        <div className="h-4 w-full rounded" style={{ background: "var(--bg-tertiary)" }} />
        <div className="h-3 w-24 rounded" style={{ background: "var(--bg-tertiary)" }} />
        <div className="h-5 w-20 rounded mt-1" style={{ background: "var(--bg-tertiary)" }} />
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
