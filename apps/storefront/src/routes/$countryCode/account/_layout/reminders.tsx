import { createFileRoute } from "@tanstack/react-router"
import RemindersPage from "@/pages/account/reminders"

export const Route = createFileRoute(
  "/$countryCode/account/_layout/reminders"
)({
  component: RemindersPage,
  head: () => ({
    meta: [
      { title: "Refill Reminders | Suprameds" },
      {
        name: "description",
        content:
          "Manage your medicine refill reminders. Never run out of chronic medication.",
      },
    ],
  }),
})
