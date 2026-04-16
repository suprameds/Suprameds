import { useQuery } from "@tanstack/react-query"

const BACKEND_URL = import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000"

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

export function useBlogPosts(category?: string, search?: string) {
  return useQuery({
    queryKey: ["blog", "posts", category || "all", search || ""],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" })
      if (category && category !== "all") params.set("category", category)
      if (search && search.trim()) params.set("q", search.trim())
      const response = await fetch(`${BACKEND_URL}/blog?${params}`)
      const res = await response.json() as { posts: BlogPostSummary[]; count: number }
      return res
    },
    staleTime: 10 * 60 * 1000, // 10 min — blog content rarely changes
  })
}

export function useBlogPost(slug: string) {
  return useQuery({
    queryKey: ["blog", "post", slug],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/blog/${slug}`)
      const res = await response.json() as { post: BlogPostFull }
      return res.post
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  })
}
