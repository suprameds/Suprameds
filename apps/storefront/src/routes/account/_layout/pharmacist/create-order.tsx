import { createFileRoute } from "@tanstack/react-router"
import CreateOrderPage from "@/pages/account/pharmacist/create-order"

export const Route = createFileRoute(
  "/account/_layout/pharmacist/create-order"
)({
  head: () => ({
    meta: [
      { title: "Create Order | Pharmacist | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CreateOrderPage,
})
