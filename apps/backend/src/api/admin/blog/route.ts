import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../modules/blog"

// GET /admin/blog — list all posts with optional status/category filter
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blogService = req.scope.resolve(BLOG_MODULE) as any
  const { status, category, limit = "50", offset = "0" } = req.query as Record<string, string>

  const filters: Record<string, any> = {}
  if (status) filters.status = status
  if (category) filters.category = category

  const posts = await blogService.listBlogPosts(
    filters,
    { take: Number(limit), skip: Number(offset), order: { date: "DESC" } }
  )

  // Get total count
  const [, count] = await blogService.listAndCountBlogPosts(filters)

  return res.json({ posts, count, limit: Number(limit), offset: Number(offset) })
}

// POST /admin/blog — create a new post
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const blogService = req.scope.resolve(BLOG_MODULE) as any
  const body = req.body as any

  if (!body.title || !body.slug || !body.content) {
    return res.status(400).json({ error: "title, slug, and content are required" })
  }

  // Auto-generate slug from title if not provided
  if (!body.slug) {
    body.slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  }

  const post = await blogService.createBlogPosts({
    slug: body.slug,
    title: body.title,
    content: body.content,
    description: body.description || "",
    category: body.category || "guides",
    tags: body.tags || [],
    author: body.author || "Suprameds Pharmacy Team",
    date: body.date || new Date().toISOString().split("T")[0],
    read_time: body.read_time || "5 min read",
    status: body.status || "draft",
    featured_image_url: body.featured_image_url || null,
    seo_title: body.seo_title || null,
    seo_description: body.seo_description || null,
  })

  return res.status(201).json({ post })
}
