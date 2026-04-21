import { createFileRoute } from "@tanstack/react-router"
import RxQueuePage from "@/pages/account/pharmacist/rx-queue"

export const Route = createFileRoute(
  "/account/_layout/pharmacist/rx-queue"
)({
  head: () => ({
    meta: [
      { title: "Rx Queue | Pharmacist | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RxQueuePage,
})
