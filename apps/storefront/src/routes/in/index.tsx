import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * Legacy URL redirect: `/in` → `/`
 *
 * Prior to the country-prefix removal, the homepage lived at `/in`.
 * External links, bookmarks, and existing backlinks are 301-redirected
 * to the new root path.
 *
 * This is an INDEX route (leaf) — not a parent layout — so it runs only
 * for the exact path `/in` and never intercepts deeper `/in/...` URLs,
 * which are handled by the sibling splat route.
 */
export const Route = createFileRoute("/in/")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 })
  },
})
