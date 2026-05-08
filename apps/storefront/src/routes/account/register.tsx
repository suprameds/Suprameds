import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/account/register")({
  validateSearch: (search: Record<string, unknown>): { redirectTo?: string; ref?: string } => ({
    redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/account/login",
      search: {
        redirectTo: search.redirectTo,
        ...(search.ref ? { ref: search.ref } : {}),
      } as never,
      replace: true,
    })
  },
  component: () => null,
})
