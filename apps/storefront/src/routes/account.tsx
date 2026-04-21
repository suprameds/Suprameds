import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { sdk } from "@/lib/utils/sdk"

export const Route = createFileRoute("/account")({
  beforeLoad: async ({ location }) => {
    const isAuthRoute =
      location.pathname.endsWith("/login") ||
      location.pathname.endsWith("/register") ||
      location.pathname.endsWith("/forgot-password") ||
      location.pathname.endsWith("/reset-password")

    // Login/register pages should be reachable without forcing a customer lookup.
    // This avoids noisy 401s for unauthenticated visitors.
    if (isAuthRoute) {
      return {}
    }

    try {
      await sdk.store.customer.retrieve()
      return {}
    } catch (e: unknown) {
      // Re-throw TanStack Router redirects
      if (
        e != null &&
        typeof e === "object" &&
        "__isRedirect" in e
      ) {
        throw e
      }
      throw redirect({
        to: "/account/login",
        search: { redirectTo: location.pathname },
      })
    }
  },
  component: () => <Outlet />,
})
