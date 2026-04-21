import { useCustomer } from "@/lib/hooks/use-customer"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { useToast } from "@/lib/context/toast-context"
import { useCallback } from "react"

/**
 * Returns a guard function that checks if the user is logged in.
 * If not, shows a toast and redirects to login with a return URL.
 *
 * Usage:
 *   const requireAuth = useRequireAuth()
 *   const handleAddToCart = () => {
 *     if (!requireAuth()) return
 *     // ... proceed with add to cart
 *   }
 */
export function useRequireAuth() {
  const { data: customer } = useCustomer()
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()

  return useCallback((): boolean => {
    if (customer) return true

    showToast("Please sign in to continue")
    navigate({
      to: "/account/login",
      search: { redirectTo: location.pathname } as any,
    })
    return false
  }, [customer, navigate, location.pathname, showToast])
}
