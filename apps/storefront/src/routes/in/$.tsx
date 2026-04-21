import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * Legacy URL redirect: `/in/<anything>` → `/<anything>`
 *
 * Catches every path still prefixed with the legacy country code and
 * 301-redirects to the non-prefixed equivalent (e.g.
 * `/in/products/atorcyn-10` → `/products/atorcyn-10`). Preserves the
 * entire sub-path via the `_splat` param.
 *
 * Sibling of `in/index.tsx` — no shared parent layout, so each fires
 * only on its own match and the parent never short-circuits the child.
 */
export const Route = createFileRoute("/in/$")({
  beforeLoad: ({ params }) => {
    const rest = (params as { _splat?: string })._splat
    const target = rest ? `/${rest}` : "/"
    throw redirect({ to: target, statusCode: 301 })
  },
})
