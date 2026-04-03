import { useCustomer } from "@/lib/hooks/use-customer"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { getCountryCodeFromPath } from "@/lib/utils/region"
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
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"

  return useCallback((): boolean => {
    if (customer) return true

    showToast("Please sign in to continue")
    navigate({
      to: "/$countryCode/account/login",
      params: { countryCode },
      search: { redirectTo: location.pathname } as any,
    })
    return false
  }, [customer, navigate, countryCode, location.pathname, showToast])
}
