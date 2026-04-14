import { isNativeApp } from "@/lib/utils/capacitor"
import { Outlet, useLocation } from "@tanstack/react-router"

/**
 * Animated page outlet for native app.
 * Uses CSS fade animation on route change. Falls through to plain Outlet on web.
 */
export function AnimatedOutlet() {
  const location = useLocation()

  if (!isNativeApp()) return <Outlet />

  return (
    <div
      key={location.pathname}
      className="animate-[page-enter_0.2s_ease-out_both]"
    >
      <Outlet />
    </div>
  )
}
