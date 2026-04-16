import { createFileRoute } from "@tanstack/react-router"
import BlogArticlePage from "@/pages/blog/article"
import type { BlogPostFull } from "@/lib/hooks/use-blog"

const BACKEND_URL = import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000"

export const Route = createFileRoute("/$countryCode/blog/$slug")({
  loader: async ({ params }: { params: { slug: string } }) => {
    try {
      const response = await fetch(`${BACKEND_URL}/blog/${params.slug}`)
      const res = await response.json() as { post: BlogPostFull }
      return { post: res.post }
    } catch {
      return { post: null }
    }
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post
    const siteUrl =
      import.meta.env.VITE_SITE_URL || "https://suprameds.in"

    const articleSchema = post
      ? {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.seo_title || post.title,
          description: post.seo_description || post.description,
          datePublished: post.date,
          author: {
            "@type": "Organization",
            name: post.author || "Suprameds Pharmacy Team",
          },
          publisher: {
            "@type": "Organization",
            name: "Suprameds",
            url: siteUrl,
          },
          ...(post.featured_image_url
            ? { image: post.featured_image_url }
            : {}),
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": `${siteUrl}/in/blog/${post.slug}`,
          },
        }
      : null

    return {
      meta: [
        {
          title: `${post?.seo_title || post?.title || "Blog"} | Suprameds`,
        },
        {
          name: "description",
          content: post?.seo_description || post?.description || "",
        },
        {
          property: "og:title",
          content: post?.seo_title || post?.title || "",
        },
        {
          property: "og:description",
          content: post?.seo_description || post?.description || "",
        },
        { property: "og:type", content: "article" },
        ...(post?.date
          ? [{ name: "article:published_time", content: post.date }]
          : []),
        ...(post?.featured_image_url
          ? [{ property: "og:image", content: post.featured_image_url }]
          : []),
      ],
      scripts: articleSchema
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(articleSchema),
            },
          ]
        : [],
    }
  },
  component: BlogArticlePage,
})
