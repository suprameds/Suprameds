import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../modules/blog"

// GET /store/blog — list published posts with optional search
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blogService = req.scope.resolve(BLOG_MODULE) as any
  const { category, q, limit = "20", offset = "0" } = req.query as Record<string, string>

  const filters: Record<string, any> = { status: "published" }
  if (category && category !== "all") filters.category = category

  // Search: filter by title or description containing the query
  if (q && q.trim()) {
    filters.$or = [
      { title: { $ilike: `%${q.trim()}%` } },
      { description: { $ilike: `%${q.trim()}%` } },
    ]
  }

  let posts: any[]
  let count: number

  try {
    posts = await blogService.listBlogPosts(
      filters,
      {
        take: Number(limit),
        skip: Number(offset),
        order: { date: "DESC" },
        select: ["id", "slug", "title", "description", "category", "tags", "author", "date", "read_time", "featured_image_url"],
      }
    )
    const result = await blogService.listAndCountBlogPosts(filters)
    count = Array.isArray(result) ? result[1] : 0
  } catch {
    // $ilike may not be supported — fall back to unfiltered list
    // and filter in memory
    const allPosts = await blogService.listBlogPosts(
      { status: "published", ...(category && category !== "all" ? { category } : {}) },
      { take: 200, order: { date: "DESC" }, select: ["id", "slug", "title", "description", "category", "tags", "author", "date", "read_time", "featured_image_url"] }
    )
    if (q && q.trim()) {
      const query = q.trim().toLowerCase()
      posts = allPosts.filter((p: any) =>
        p.title?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        (p.tags || []).some((t: string) => t.toLowerCase().includes(query))
      )
    } else {
      posts = allPosts
    }
    posts = posts.slice(Number(offset), Number(offset) + Number(limit))
    count = posts.length
  }

  return res.json({ posts, count })
}
