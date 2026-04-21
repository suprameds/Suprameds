import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/account/_layout/")({
  head: () => ({
    meta: [
      { title: "My Account | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({
      to: "/account/profile",
    })
  },
  component: () => null,
})
