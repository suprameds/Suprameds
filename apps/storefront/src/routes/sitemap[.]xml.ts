import { createFileRoute } from "@tanstack/react-router"

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const SITE_URL = process.env.VITE_SITE_URL || "https://suprameds.in"
const PUBLISHABLE_KEY = process.env.VITE_MEDUSA_PUBLISHABLE_KEY || ""

const COMPLIANCE_PAGES = [
  "licenses",
  "grievance",
  "privacy",
  "returns",
  "prescription-policy",
  "terms",
]

function urlEntry(
  loc: string,
  priority: string,
  changefreq: string,
  lastmod?: string,
): string {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ``
  return `  <url>
    <loc>${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${lastmodTag}
  </url>`
}

function formatDate(isoString?: string): string | undefined {
  if (!isoString) return undefined
  return isoString.split("T")[0]
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().split("T")[0]

        // Static pages always included
        const staticEntries = [
          urlEntry(`${SITE_URL}/in`, `1.0`, `daily`, today),
          urlEntry(`${SITE_URL}/in/store`, `0.9`, `daily`, today),
          ...COMPLIANCE_PAGES.map((slug) =>
            urlEntry(`${SITE_URL}/${slug}`, `0.3`, `monthly`),
          ),
        ]

        let productEntries: string[] = []
        let categoryEntries: string[] = []

        const apiHeaders: Record<string, string> = {}
        if (PUBLISHABLE_KEY) {
          apiHeaders["x-publishable-api-key"] = PUBLISHABLE_KEY
        }

        try {
          const [productsRes, categoriesRes] = await Promise.all([
            fetch(
              `${BACKEND_URL}/store/products?limit=1000&fields=handle,updated_at`,
              { headers: apiHeaders },
            ),
            fetch(
              `${BACKEND_URL}/store/product-categories?limit=100&fields=handle,updated_at`,
              { headers: apiHeaders },
            ),
          ])

          if (productsRes.ok) {
            const { products } = (await productsRes.json()) as {
              products: Array<{ handle: string; updated_at?: string }>
            }
            productEntries = products.flatMap((p) => {
              if (!p.handle) return []
              const lastmod = formatDate(p.updated_at)
              return [
                urlEntry(
                  `${SITE_URL}/in/products/${p.handle}`,
                  "0.8",
                  "weekly",
                  lastmod,
                ),
                urlEntry(
                  `${SITE_URL}/in/drugs/${p.handle}`,
                  "0.7",
                  "weekly",
                  lastmod,
                ),
              ]
            })
          }

          if (categoriesRes.ok) {
            const { product_categories } = (await categoriesRes.json()) as {
              product_categories: Array<{ handle: string; updated_at?: string }>
            }
            categoryEntries = product_categories.flatMap((c) => {
              if (!c.handle) return []
              return [
                urlEntry(
                  `${SITE_URL}/in/categories/${c.handle}`,
                  "0.6",
                  "weekly",
                  formatDate(c.updated_at),
                ),
              ]
            })
          }
        } catch {
          // Backend unreachable — return minimal sitemap with static pages only
        }

        const allEntries = [
          ...staticEntries,
          ...productEntries,
          ...categoryEntries,
        ].join("\n")

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries}
</urlset>`

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        })
      },
    },
  },
})
