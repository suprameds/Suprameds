import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../modules/blog"

// GET /store/blog — list published posts
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blogService = req.scope.resolve(BLOG_MODULE) as any
  const { category, limit = "20", offset = "0" } = req.query as Record<string, string>

  const filters: Record<string, any> = { status: "published" }
  if (category && category !== "all") filters.category = category

  const posts = await blogService.listBlogPosts(
    filters,
    {
      take: Number(limit),
      skip: Number(offset),
      order: { date: "DESC" },
      select: ["id", "slug", "title", "description", "category", "tags", "author", "date", "read_time", "featured_image_url"],
    }
  )

  const [, count] = await blogService.listAndCountBlogPosts(filters)

  return res.json({ posts, count })
}
