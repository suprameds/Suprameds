import { useNavigate, useLocation } from "@tanstack/react-router"
import { useCustomer } from "@/lib/hooks/use-customer"
import { useCallback } from "react"

/**
 * Action-level auth guard. Returns customer state plus a `requireAuth` gate
 * that callers invoke before sensitive actions (add to cart, checkout, etc.).
 *
 * When the user is unauthenticated, `requireAuth` redirects to /account/login
 * with `redirectTo` (current path + search) so the login flow can resume the
 * user where they were, plus an optional `pendingAction` token so the post-
 * login resume logic can replay the original intent (e.g. "add_to_cart:variant_123").
 *
 * While `useCustomer()` is still resolving, `requireAuth` returns `false`
 * without redirecting — callers should re-check after hydration.
 */
export function useAuthGuard() {
  const { data: customer, isLoading } = useCustomer()
  const navigate = useNavigate()
  const location = useLocation()

  const requireAuth = useCallback(
    (pendingAction?: string): boolean => {
      if (isLoading) return false
      if (customer) return true
      const redirectTo = location.pathname + (location.search ?? "")
      // search shape is extended beyond the login route's current
      // validateSearch (Task 2 tightens this); cast keeps both TS and the
      // route-search lint rule quiet without a ts-comment.
      const search = {
        redirectTo,
        ...(pendingAction ? { pendingAction } : {}),
      } as unknown as { redirectTo: string }
      navigate({ to: "/account/login", search })
      return false
    },
    [customer, isLoading, location, navigate]
  )

  return { customer, isLoading, isAuthenticated: !!customer, requireAuth }
}
