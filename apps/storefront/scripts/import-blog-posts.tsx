#!/usr/bin/env -S npx vite-node
/**
 * Blog Posts Import Script
 *
 * Reads the 104 static blog articles from the storefront TSX files,
 * converts their JSX content to HTML strings using renderToStaticMarkup,
 * and bulk-imports them into the Medusa blog module via the admin API.
 *
 * Prerequisites:
 *   - Backend running at MEDUSA_BACKEND_URL (default: http://localhost:9000)
 *   - Admin user credentials (ADMIN_EMAIL + ADMIN_PASSWORD)
 *   - Blog module migrated (cd apps/backend && npx medusa db:migrate)
 *
 * Usage (from apps/storefront/):
 *   npx vite-node scripts/import-blog-posts.tsx
 *   npx vite-node scripts/import-blog-posts.tsx -- --force      # Import even if posts exist
 *   npx vite-node scripts/import-blog-posts.tsx -- --dry-run    # Preview without importing
 *   MEDUSA_BACKEND_URL=https://api.example.com npx vite-node scripts/import-blog-posts.tsx
 *
 * Usage (from monorepo root):
 *   cd apps/storefront && npx vite-node scripts/import-blog-posts.tsx
 *
 * Auth env vars:
 *   ADMIN_EMAIL       Admin email (default: admin@suprameds.in)
 *   ADMIN_PASSWORD    Admin password (default: supersecret)
 *   ADMIN_API_TOKEN   Skip login, use this Bearer token directly
 */

import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

// Import the static blog data
import { blogPosts } from "../src/lib/data/blog-posts"

// ─── Configuration ──────────────────────────────────────────────

const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@suprameds.in"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "supersecret"
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || ""

const args = process.argv.slice(2)
const FORCE = args.includes("--force")
const DRY_RUN = args.includes("--dry-run")
const BATCH_SIZE = 10 // Posts per API call to avoid timeouts

// ─── Helpers ────────────────────────────────────────────────────

function stripDevAttributes(html: string): string {
  // Remove data-med-*, data-component-*, data-content attributes
  // injected by @medusajs-ai/tags vite plugin in dev mode
  return html.replace(
    /\s+data-(?:med-[a-z-]+|component[a-z-]*|content)="[^"]*"/g,
    ""
  )
}

function renderContentToHtml(contentFn: () => React.ReactNode): string {
  try {
    const element = contentFn()
    // renderToStaticMarkup needs a valid ReactElement, wrap fragments in a div
    const wrapped = React.createElement("div", null, element)
    let html = renderToStaticMarkup(wrapped)
    // Remove the wrapping <div>...</div>
    html = html.replace(/^<div>/, "").replace(/<\/div>$/, "")
    // Strip dev-mode data attributes from vite plugins
    html = stripDevAttributes(html)
    return html
  } catch (err: any) {
    console.error(`  Failed to render content: ${err.message}`)
    return ""
  }
}

async function getAdminToken(): Promise<string> {
  if (ADMIN_API_TOKEN) {
    return ADMIN_API_TOKEN
  }

  console.log(`Authenticating as ${ADMIN_EMAIL}...`)
  const res = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Admin login failed (${res.status}): ${text}\n` +
        "Set ADMIN_EMAIL and ADMIN_PASSWORD env vars, or ADMIN_API_TOKEN."
    )
  }

  const data = (await res.json()) as { token?: string }
  if (!data.token) {
    throw new Error("Login response missing token")
  }

  return data.token
}

interface ImportPost {
  slug: string
  title: string
  content: string
  description: string
  category: string
  tags: string[]
  author: string
  date: string
  read_time: string
  status: string
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("=== Suprameds Blog Import ===")
  console.log(`Backend: ${BACKEND_URL}`)
  console.log(`Source:  ${blogPosts.length} static articles`)
  console.log(`Mode:    ${DRY_RUN ? "DRY RUN" : "LIVE IMPORT"}`)
  console.log()

  // Step 1: Convert JSX content to HTML
  console.log("Rendering JSX content to HTML...")
  const posts: ImportPost[] = []

  for (const post of blogPosts) {
    const html = renderContentToHtml(post.content)
    posts.push({
      slug: post.slug,
      title: post.title,
      content: html,
      description: post.description,
      category: post.category,
      tags: post.tags,
      author: post.author,
      date: post.date,
      read_time: post.readTime, // camelCase -> snake_case
      status: "published",
    })
  }

  console.log(`Rendered ${posts.length} articles to HTML`)

  // Show a sample
  const sample = posts[0]
  if (sample) {
    console.log(`\nSample: "${sample.title}"`)
    console.log(`  Slug:     ${sample.slug}`)
    console.log(`  Category: ${sample.category}`)
    console.log(`  Date:     ${sample.date}`)
    console.log(`  Content:  ${sample.content.length} chars`)
    console.log(`  Preview:  ${sample.content.slice(0, 120)}...`)
  }

  if (DRY_RUN) {
    console.log("\n--- DRY RUN: No data sent to API ---")
    console.log(`Would import ${posts.length} posts\n`)
    // Print all slugs grouped by category
    const byCategory: Record<string, string[]> = {}
    for (const p of posts) {
      ;(byCategory[p.category] ||= []).push(p.slug)
    }
    for (const [cat, slugs] of Object.entries(byCategory)) {
      console.log(`${cat} (${slugs.length}):`)
      for (const s of slugs) {
        console.log(`  - ${s}`)
      }
    }
    return
  }

  // Step 2: Authenticate
  const token = await getAdminToken()
  console.log("Authenticated successfully\n")

  // Step 3: Send posts to the import endpoint in batches
  console.log(`Importing ${posts.length} posts in batches of ${BATCH_SIZE}...`)

  let totalCreated = 0
  let totalSkipped = 0
  const allErrors: string[] = []

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(posts.length / BATCH_SIZE)

    process.stdout.write(
      `  Batch ${batchNum}/${totalBatches} (${batch.length} posts)... `
    )

    try {
      const res = await fetch(`${BACKEND_URL}/admin/blog/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ posts: batch, force: FORCE }),
      })

      if (!res.ok) {
        const text = await res.text()
        console.log(`FAILED (${res.status})`)
        allErrors.push(`Batch ${batchNum}: HTTP ${res.status} - ${text.slice(0, 200)}`)

        // If first batch fails without --force, it's likely the "posts exist" guard
        if (batchNum === 1 && !FORCE) {
          try {
            const body = JSON.parse(text)
            if (body.existing) {
              console.log(`\n${body.message}`)
              console.log("Run with --force to import anyway.")
              return
            }
          } catch {
            // not JSON, continue
          }
        }
        continue
      }

      const result = (await res.json()) as {
        imported: number
        skipped: number
        existing?: number
        message?: string
        errors?: string[]
      }

      // The endpoint returns early (200, not error) when posts exist and force is not set
      if (result.imported === 0 && result.existing && result.existing > 0 && !FORCE) {
        console.log(`\n${result.message}`)
        console.log("Run with --force to import anyway.")
        return
      }

      totalCreated += result.imported
      totalSkipped += result.skipped
      if (result.errors) allErrors.push(...result.errors)

      console.log(
        `OK (${result.imported} created, ${result.skipped} skipped)`
      )
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`)
      allErrors.push(`Batch ${batchNum}: ${err.message}`)
    }
  }

  // Summary
  console.log("\n=== Import Complete ===")
  console.log(`  Created:  ${totalCreated}`)
  console.log(`  Skipped:  ${totalSkipped}`)
  console.log(`  Total:    ${posts.length}`)

  if (allErrors.length > 0) {
    console.log(`  Errors:   ${allErrors.length}`)
    for (const err of allErrors) {
      console.log(`    - ${err}`)
    }
  }

  if (totalCreated > 0) {
    console.log(`\nBlog posts are now available at ${BACKEND_URL.replace("localhost:9000", "localhost:5173")}/in/blog`)
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err.message)
  process.exit(1)
})
