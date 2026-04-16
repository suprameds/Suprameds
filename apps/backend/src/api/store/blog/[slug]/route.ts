import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../../modules/blog"

// GET /store/blog/:slug — get single published post by slug
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blogService = req.scope.resolve(BLOG_MODULE) as any
  const { slug } = req.params

  const [post] = await blogService.listBlogPosts(
    { slug, status: "published" },
    { take: 1 }
  )

  if (!post) {
    return res.status(404).json({ error: "Post not found" })
  }

  return res.json({ post })
}
