import { useRef, useState, useCallback, type ReactNode } from "react"
import { isNativeApp } from "@/lib/utils/capacitor"
import { hapticImpact } from "@/lib/utils/haptics"

const THRESHOLD = 60
const MAX_PULL = 100

/**
 * Pull-to-refresh wrapper for native app.
 * Renders children as-is on web. On native, wraps with touch-based pull detection.
 */
export function PullToRefresh({
  children,
  onRefresh,
}: {
  children: ReactNode
  onRefresh: () => Promise<void> | void
}) {
  if (!isNativeApp()) return <>{children}</>
  return <PullToRefreshInner onRefresh={onRefresh}>{children}</PullToRefreshInner>
}

function PullToRefreshInner({
  children,
  onRefresh,
}: {
  children: ReactNode
  onRefresh: () => Promise<void> | void
}) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return
    if (window.scrollY > 0) return
    startY.current = e.touches[0].clientY
    pulling.current = true
  }, [refreshing])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return
    if (window.scrollY > 0) {
      pulling.current = false
      setPullDistance(0)
      return
    }

    const delta = e.touches[0].clientY - startY.current
    if (delta <= 0) {
      setPullDistance(0)
      return
    }

    // Resistance curve: diminishing returns past threshold
    const distance = Math.min(delta * 0.5, MAX_PULL)
    setPullDistance(distance)
  }, [refreshing])

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return
    pulling.current = false

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true)
      hapticImpact("light")
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, refreshing, onRefresh])

  const isActive = pullDistance > 0 || refreshing
  const pastThreshold = pullDistance >= THRESHOLD

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Spinner indicator */}
      <div
        className="absolute left-1/2 z-30 flex items-center justify-center pointer-events-none"
        style={{
          transform: `translate(-50%, ${isActive ? Math.max(pullDistance - 20, 0) : -40}px)`,
          opacity: isActive ? 1 : 0,
          transition: pulling.current ? "none" : "all 0.3s ease-out",
          top: 0,
        }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shadow-md"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-primary)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={refreshing ? "animate-spin" : ""}
            style={{
              color: pastThreshold || refreshing ? "var(--brand-teal)" : "var(--text-tertiary)",
              transform: !refreshing ? `rotate(${pullDistance * 3}deg)` : undefined,
              transition: pulling.current ? "none" : "color 0.2s",
            }}
          >
            {refreshing ? (
              <>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </>
            ) : (
              <>
                <path d="M12 5v14" />
                <path d="M19 12l-7 7-7-7" />
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: isActive ? `translateY(${Math.min(pullDistance, MAX_PULL) * 0.3}px)` : "none",
          transition: pulling.current ? "none" : "transform 0.3s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  )
}
