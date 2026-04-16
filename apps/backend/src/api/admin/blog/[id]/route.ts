import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../../modules/blog"

// GET /admin/blog/:id — get single post
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blogService = req.scope.resolve(BLOG_MODULE) as any
  const { id } = req.params

  try {
    const post = await blogService.retrieveBlogPost(id)
    return res.json({ post })
  } catch {
    return res.status(404).json({ error: "Post not found" })
  }
}

// POST /admin/blog/:id — update post
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const blogService = req.scope.resolve(BLOG_MODULE) as any
  const { id } = req.params
  const body = req.body as any

  const post = await blogService.updateBlogPosts({
    id,
    ...body,
  })

  return res.json({ post })
}

// DELETE /admin/blog/:id — delete post
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const blogService = req.scope.resolve(BLOG_MODULE) as any
  const { id } = req.params

  await blogService.deleteBlogPosts(id)
  return res.json({ id, deleted: true })
}
