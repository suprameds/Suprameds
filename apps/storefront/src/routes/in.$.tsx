import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * Legacy URL redirect: /in/<anything> → /<anything>
 *
 * Catches any path still prefixed with the legacy country code and 301-redirects
 * to the non-prefixed equivalent (e.g. /in/products/foo → /products/foo).
 */
export const Route = createFileRoute("/in/$")({
  beforeLoad: ({ params }) => {
    const rest = (params as { _splat?: string })._splat
    const target = rest ? `/${rest}` : "/"
    throw redirect({ to: target, statusCode: 301 })
  },
})
