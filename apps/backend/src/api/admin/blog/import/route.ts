import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../../modules/blog"

interface ImportPostBody {
  slug: string
  title: string
  content: string
  description?: string
  category?: string
  tags?: string[]
  author?: string
  date?: string
  read_time?: string
  status?: string
  featured_image_url?: string | null
  seo_title?: string | null
  seo_description?: string | null
}

/**
 * POST /admin/blog/import
 *
 * Bulk-imports blog posts into the database.
 * Accepts { posts: ImportPostBody[] } in the request body.
 * Skips posts whose slug already exists (no duplicates).
 *
 * Usage:
 *   cd apps/storefront && npx vite-node scripts/import-blog-posts.tsx
 *   cd apps/storefront && pnpm import:blog
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const blogService = req.scope.resolve(BLOG_MODULE) as any
  const body = req.body as { posts?: ImportPostBody[]; force?: boolean }

  if (!body.posts || !Array.isArray(body.posts) || body.posts.length === 0) {
    return res.status(400).json({
      error: "Request body must contain a non-empty 'posts' array",
    })
  }

  // Get existing slugs to skip duplicates
  const existingPosts = await blogService.listBlogPosts(
    {},
    { take: 500, select: ["slug"] }
  )
  const existingSlugs = new Set(
    (existingPosts || []).map((p: any) => p.slug)
  )

  const existingCount = existingSlugs.size

  // If force is not set and posts already exist, warn
  if (existingCount > 0 && !body.force) {
    return res.json({
      message: `${existingCount} posts already exist. Pass { force: true } to import anyway (duplicates will be skipped).`,
      imported: 0,
      skipped: 0,
      existing: existingCount,
    })
  }

  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const post of body.posts) {
    if (!post.slug || !post.title) {
      errors.push(`Missing slug or title: ${JSON.stringify(post).slice(0, 100)}`)
      continue
    }

    // Skip existing slugs
    if (existingSlugs.has(post.slug)) {
      skipped++
      continue
    }

    try {
      await blogService.createBlogPosts({
        slug: post.slug,
        title: post.title,
        content: post.content || "",
        description: post.description || "",
        category: post.category || "guides",
        tags: (post.tags || []) as any,
        author: post.author || "Suprameds Pharmacy Team",
        date: post.date || new Date().toISOString().split("T")[0],
        read_time: post.read_time || "5 min read",
        status: post.status || "published",
        featured_image_url: post.featured_image_url || null,
        seo_title: post.seo_title || null,
        seo_description: post.seo_description || null,
      })
      created++
      existingSlugs.add(post.slug)
    } catch (err: any) {
      errors.push(`${post.slug}: ${err.message}`)
    }
  }

  return res.json({
    message: `Imported ${created} posts, skipped ${skipped} duplicates`,
    imported: created,
    skipped,
    existing: existingCount,
    errors: errors.length > 0 ? errors : undefined,
  })
}
