import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * GET /store/products/search?q=paracetamol&limit=20&offset=0&category_id=diabetic,cardiac-care
 *
 * PostgreSQL full-text search across product fields (title, subtitle, description, handle)
 * and pharma drug_product fields (generic_name, composition, strength).
 *
 * - `q` is optional: when empty but `category_id` is present, returns category products.
 * - `category_id` accepts comma-separated category **handles** (e.g., "diabetic,cardiac-care")
 *   or a single UUID (starts with "cat_").
 *
 * Results are ranked by ts_rank with product fields weighted higher.
 * Only returns published, non-deleted products.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = ((req.query.q as string) ?? "").trim()
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100)
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0)
  const categoryIdRaw = ((req.query.category_id as string) ?? "").trim()

  if (!q && !categoryIdRaw) {
    return res.json({ products: [], count: 0 })
  }

  // ── Cache check (keyed on normalized query params) ──
  const cacheService = req.scope.resolve(Modules.CACHE)
  const cacheKey = `store:products:search:${q}:${categoryIdRaw}:${limit}:${offset}`

  try {
    const cached = await cacheService.get<any>(cacheKey)
    if (cached) {
      return res.json(cached)
    }
  } catch {
    // Cache read failure is non-fatal — proceed with DB query
  }

  const pgConnection = req.scope.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  )

  // ── Category filter logic ──
  // Detect UUID vs handle(s). UUIDs start with "cat_", handles are slugs.
  const isUuid = categoryIdRaw.startsWith("cat_")
  const categoryHandles = !isUuid && categoryIdRaw
    ? categoryIdRaw.split(",").map((h) => h.trim()).filter(Boolean)
    : []

  let categoryJoin = ""
  const bindings: Record<string, unknown> = { limit, offset }

  if (isUuid) {
    categoryJoin = `INNER JOIN "product_category_product" pcp ON pcp."product_id" = p."id" AND pcp."product_category_id" = :categoryId`
    bindings.categoryId = categoryIdRaw
  } else if (categoryHandles.length > 0) {
    // Build parameterized IN clause for handles
    const handleParams = categoryHandles.map((h, i) => {
      const key = `handle_${i}`
      bindings[key] = h
      return `:${key}`
    })
    categoryJoin = `INNER JOIN "product_category_product" pcp ON pcp."product_id" = p."id"
      AND pcp."product_category_id" IN (
        SELECT pc."id" FROM "product_category" pc
        WHERE pc."handle" IN (${handleParams.join(", ")})
      )`
  }

  // ── Build FTS tokens (if q is provided) ──
  let tsqueryString = ""
  if (q) {
    const tokens = q
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t.toLowerCase())

    if (tokens.length === 0 && !categoryIdRaw) {
      return res.json({ products: [], count: 0 })
    }
    tsqueryString = tokens.map((t) => `${t}:*`).join(" & ")
  }

  try {
    let searchQuery: string

    if (tsqueryString) {
      // ── FTS mode: q provided (optionally with category filter) ──
      bindings.tsquery = tsqueryString

      searchQuery = `
        WITH fts AS (
          SELECT
            p."id",
            p."title",
            p."handle",
            p."thumbnail",
            p."description",
            p."subtitle",
            p."status",
            dp."id"              AS dp_id,
            dp."schedule",
            dp."generic_name",
            dp."dosage_form",
            dp."strength",
            dp."composition",
            dp."gst_rate",
            dp."manufacturer_license" AS manufacturer,
            (
              ts_rank(COALESCE(p."search_vector", ''::tsvector), to_tsquery('english', :tsquery)) * 2.0
              +
              ts_rank(
                setweight(to_tsvector('english', COALESCE(dp."generic_name", '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(dp."composition", '')), 'B') ||
                setweight(to_tsvector('english', COALESCE(dp."strength", '')), 'C'),
                to_tsquery('english', :tsquery)
              )
            ) AS rank
          FROM "product" p
          LEFT JOIN "drug_product" dp ON dp."product_id" = p."id" AND dp."deleted_at" IS NULL
          ${categoryJoin}
          WHERE p."deleted_at" IS NULL
            AND p."status" = 'published'
            AND (
              p."search_vector" @@ to_tsquery('english', :tsquery)
              OR
              (
                setweight(to_tsvector('english', COALESCE(dp."generic_name", '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(dp."composition", '')), 'B') ||
                setweight(to_tsvector('english', COALESCE(dp."strength", '')), 'C')
              ) @@ to_tsquery('english', :tsquery)
            )
        )
        SELECT *, COUNT(*) OVER() AS total_count
        FROM fts
        ORDER BY rank DESC, title ASC
        LIMIT :limit
        OFFSET :offset
      `
    } else {
      // ── Category-only mode: no q, just browsing by category ──
      searchQuery = `
        SELECT
          p."id",
          p."title",
          p."handle",
          p."thumbnail",
          p."description",
          p."subtitle",
          p."status",
          dp."id"              AS dp_id,
          dp."schedule",
          dp."generic_name",
          dp."dosage_form",
          dp."strength",
          dp."composition",
          dp."gst_rate",
          dp."manufacturer_license" AS manufacturer,
          COUNT(*) OVER()      AS total_count
        FROM "product" p
        LEFT JOIN "drug_product" dp ON dp."product_id" = p."id" AND dp."deleted_at" IS NULL
        ${categoryJoin}
        WHERE p."deleted_at" IS NULL
          AND p."status" = 'published'
        ORDER BY p."title" ASC
        LIMIT :limit
        OFFSET :offset
      `
    }

    const result = await pgConnection.raw(searchQuery, bindings)

    const rows = result?.rows ?? result?.[0] ?? []
    const totalCount = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0

    const products = rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      title: row.title,
      handle: row.handle,
      thumbnail: row.thumbnail,
      description: row.description,
      subtitle: row.subtitle,
      status: row.status,
      drug_product: row.dp_id
        ? {
            id: row.dp_id,
            schedule: row.schedule,
            generic_name: row.generic_name,
            dosage_form: row.dosage_form,
            strength: row.strength,
            composition: row.composition,
            gst_rate: row.gst_rate,
            manufacturer: row.manufacturer,
          }
        : null,
    }))

    const response = { products, count: totalCount }

    try {
      await cacheService.set(cacheKey, response, 120) // 2 min TTL for search
    } catch {
      // Cache write failure is non-fatal
    }

    return res.json(response)
  } catch (error) {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error("[search] FTS query failed:", error)

    return res.status(500).json({
      message: "Search failed. Please try a different search term.",
    })
  }
}
