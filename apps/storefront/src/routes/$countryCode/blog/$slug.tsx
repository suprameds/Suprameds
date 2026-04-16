import { createFileRoute, notFound } from "@tanstack/react-router"
import BlogArticlePage from "@/pages/blog/article"
import { blogPosts } from "@/lib/data/blog-posts"

// @ts-expect-error Route tree not yet regenerated for new blog routes
export const Route = createFileRoute("/$countryCode/blog/$slug")({
  loader: ({ params }: { params: { slug: string } }) => {
    const post = blogPosts.find((p) => p.slug === params.slug)
    if (!post) throw notFound()
    return { post }
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post
    return {
      meta: [
        { title: `${post?.title || "Blog"} | Suprameds` },
        { name: "description", content: post?.description || "" },
        { property: "og:title", content: post?.title || "" },
        { property: "og:description", content: post?.description || "" },
        { property: "og:type", content: "article" },
      ],
    }
  },
  component: BlogArticlePage,
})
