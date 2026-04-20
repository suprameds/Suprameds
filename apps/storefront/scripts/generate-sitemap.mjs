/**
 * Generates sitemap.xml by fetching products and categories from the Medusa backend.
 * Run: node scripts/generate-sitemap.mjs
 * Typically called as part of the build process or via cron.
 */

import { writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const SITE_URL = process.env.SITE_URL || "https://store.supracynpharma.com"
const BACKEND_URL = process.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_KEY = process.env.VITE_MEDUSA_PUBLISHABLE_KEY || ""

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

async function fetchJson(path) {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function main() {
  console.log("[sitemap] Fetching products and categories...")

  const [productsRes, categoriesRes] = await Promise.all([
    fetchJson("/store/products?fields=handle,updated_at&limit=1000"),
    fetchJson("/store/product-categories?fields=handle&limit=500"),
  ])

  const products = productsRes?.products || []
  const categories = categoriesRes?.product_categories || []
  const today = new Date().toISOString().split("T")[0]

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/in</loc><changefreq>daily</changefreq><priority>1.0</priority><lastmod>${today}</lastmod></url>
  <url><loc>${SITE_URL}/in/store</loc><changefreq>daily</changefreq><priority>0.9</priority><lastmod>${today}</lastmod></url>
  <url><loc>${SITE_URL}/in/search</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`

  for (const cat of categories) {
    if (!cat.handle) continue
    xml += `\n  <url><loc>${SITE_URL}/in/categories/${escapeXml(cat.handle)}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`
  }

  for (const p of products) {
    if (!p.handle) continue
    const lastmod = p.updated_at ? p.updated_at.split("T")[0] : today
    xml += `\n  <url><loc>${SITE_URL}/in/products/${escapeXml(p.handle)}</loc><changefreq>weekly</changefreq><priority>0.7</priority><lastmod>${lastmod}</lastmod></url>`
  }

  xml += `\n</urlset>`

  const outPath = resolve(__dirname, "../public/sitemap.xml")
  writeFileSync(outPath, xml, "utf-8")
  console.log(`[sitemap] Written ${products.length} products + ${categories.length} categories → ${outPath}`)
}

main().catch((err) => {
  console.error("[sitemap] Failed:", err)
  process.exit(1)
})
