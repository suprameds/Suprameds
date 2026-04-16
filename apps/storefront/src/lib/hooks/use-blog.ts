import { useQuery } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"

export interface BlogPostSummary {
  id: string
  slug: string
  title: string
  description: string
  category: string
  tags: string[]
  author: string
  date: string
  read_time: string
  featured_image_url: string | null
}

export interface BlogPostFull extends BlogPostSummary {
  content: string
  seo_title: string | null
  seo_description: string | null
}

export function useBlogPosts(category?: string) {
  return useQuery({
    queryKey: ["blog", "posts", category || "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" })
      if (category && category !== "all") params.set("category", category)
      const res = await sdk.client.fetch<{
        posts: BlogPostSummary[]
        count: number
      }>(`/store/blog?${params}`, { method: "GET" })
      return res
    },
    staleTime: 10 * 60 * 1000, // 10 min — blog content rarely changes
  })
}

export function useBlogPost(slug: string) {
  return useQuery({
    queryKey: ["blog", "post", slug],
    queryFn: async () => {
      const res = await sdk.client.fetch<{ post: BlogPostFull }>(
        `/store/blog/${slug}`,
        { method: "GET" }
      )
      return res.post
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  })
}
