import { createFileRoute } from "@tanstack/react-router"
import WishlistPage from "@/pages/account/wishlist"

export const Route = createFileRoute(
  "/$countryCode/account/_layout/wishlist"
)({
  component: WishlistPage,
  head: () => ({
    meta: [
      { title: "My Wishlist | Suprameds" },
      {
        name: "description",
        content:
          "Your saved products. Get notified when prices drop on your favourite medicines.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
})
