import { createFileRoute, redirect } from "@tanstack/react-router"

type SearchParams = {
  q?: string
}

/**
 * /search is now merged into /store.
 * This route redirects old /search?q=... URLs to /store?q=...
 */
export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/store",
      search: search.q ? { q: search.q } : {},
      replace: true,
    })
  },
})
