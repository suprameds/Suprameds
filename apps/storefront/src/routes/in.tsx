import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * Legacy URL redirect: /in → /
 *
 * Prior to the country-prefix removal, every route was nested under /$countryCode.
 * External links and bookmarks still pointing at /in are 301-redirected to the root.
 */
export const Route = createFileRoute("/in")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 })
  },
})
