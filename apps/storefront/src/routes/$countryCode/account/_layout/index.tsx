import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/account/_layout/")({
  head: () => ({
    meta: [
      { title: "My Account | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$countryCode/account/profile",
      params: { countryCode: params.countryCode },
    })
  },
  component: () => null,
})
