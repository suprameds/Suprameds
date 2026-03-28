import { createFileRoute } from "@tanstack/react-router"
import PrescriptionsPage from "@/pages/account/prescriptions"

export const Route = createFileRoute(
  "/$countryCode/account/_layout/prescriptions"
)({
  component: PrescriptionsPage,
})
