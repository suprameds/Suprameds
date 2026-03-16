import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { sdk } from "@/lib/utils/sdk"

export const Route = createFileRoute("/$countryCode/account")({
  beforeLoad: async ({ location, params }) => {
    const { countryCode } = params
    const isAuthRoute =
      location.pathname.endsWith("/login") ||
      location.pathname.endsWith("/register")

    try {
      await sdk.store.customer.retrieve()
      if (isAuthRoute) {
        throw redirect({
          to: "/$countryCode/account/profile",
          params: { countryCode },
        })
      }
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
      if (!isAuthRoute) {
        throw redirect({
          to: "/$countryCode/account/login",
          params: { countryCode },
        })
      }
      return {}
    }
  },
  component: () => <Outlet />,
})
