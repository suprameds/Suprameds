import { createFileRoute } from "@tanstack/react-router"
import BlogListPage from "@/pages/blog/list"

// @ts-expect-error Route tree not yet regenerated for new blog routes
export const Route = createFileRoute("/$countryCode/blog/")({
  head: () => ({
    meta: [
      { title: "Health & Medicine Blog | Suprameds" },
      {
        name: "description",
        content:
          "Expert articles on generic medicines, pharmacy tips, and health guides from India's licensed online pharmacy.",
      },
    ],
  }),
  component: BlogListPage,
})
