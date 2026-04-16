import { createFileRoute } from "@tanstack/react-router"
import BlogListPage from "@/pages/blog/list"

const siteUrl = "https://suprameds.in"

const blogCollectionSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Health & Medicine Blog",
  description:
    "Expert articles on generic medicines, pharmacy tips, and health guides from India's licensed online pharmacy.",
  url: `${siteUrl}/in/blog`,
  publisher: {
    "@type": "Organization",
    name: "Suprameds",
    url: siteUrl,
  },
  mainEntity: {
    "@type": "ItemList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Medicine Guides",
        url: `${siteUrl}/in/blog?category=guides`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Health Articles",
        url: `${siteUrl}/in/blog?category=health`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Pharmacy Tips",
        url: `${siteUrl}/in/blog?category=pharmacy`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Savings Guides",
        url: `${siteUrl}/in/blog?category=savings`,
      },
    ],
  },
}

export const Route = createFileRoute("/$countryCode/blog/")({
  head: () => ({
    meta: [
      { title: "Health & Medicine Blog | Suprameds" },
      {
        name: "description",
        content:
          "Expert articles on generic medicines, pharmacy tips, and health guides from India's licensed online pharmacy.",
      },
      {
        property: "og:title",
        content: "Health & Medicine Blog | Suprameds",
      },
      {
        property: "og:description",
        content:
          "Expert articles on generic medicines, pharmacy tips, and health guides from India's licensed online pharmacy.",
      },
      { property: "og:type", content: "website" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(blogCollectionSchema),
      },
    ],
  }),
  component: BlogListPage,
})
