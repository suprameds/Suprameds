import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/account/_layout/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$countryCode/account/profile",
      params: { countryCode: params.countryCode },
    })
  },
  component: () => null,
})
