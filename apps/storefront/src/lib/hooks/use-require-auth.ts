import { useCustomer } from "@/lib/hooks/use-customer"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { useToast } from "@/lib/context/toast-context"
import { useCallback } from "react"

/**
 * Returns a guard function that checks if the user is logged in.
 * If not, shows a toast and redirects to login with a return URL.
 *
 * Pass `pendingAction` (e.g. "add_to_cart:variant_xyz") to encode the
 * intent the user was trying to perform — the redirect target can read
 * it from search params and replay the action after authentication.
 *
 * Usage:
 *   const requireAuth = useRequireAuth()
 *   const handleAddToCart = () => {
 *     if (!requireAuth(`add_to_cart:${variant.id}`)) return
 *     // ... proceed
 *   }
 */
export function useRequireAuth() {
  const { data: customer } = useCustomer()
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()

  return useCallback(
    (pendingAction?: string): boolean => {
      if (customer) return true

      showToast("Please sign in to continue")
      navigate({
        to: "/account/login",
        search: {
          redirectTo: location.pathname,
          ...(pendingAction ? { pendingAction } : {}),
        } as never,
      })
      return false
    },
    [customer, navigate, location.pathname, showToast]
  )
}
