import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /store/pharmacist/products/search?q=paracetamol&limit=20
 * Pharmacist: product search with variant + pricing for order creation.
 * Same FTS as admin product search.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = ((req.query.q as string) ?? "").trim()
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100)
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0)

  if (!q) {
    return res.json({ products: [], count: 0 })
  }

  const pgConnection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const tokens = q
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase())

  if (tokens.length === 0) {
    return res.json({ products: [], count: 0 })
  }

  const tsqueryString = tokens.map((t) => `${t}:*`).join(" & ")

  const searchQuery = `
    WITH fts AS (
      SELECT
        p."id", p."title", p."handle", p."thumbnail", p."status",
        dp."id" AS dp_id, dp."schedule", dp."generic_name", dp."dosage_form",
        dp."strength", dp."composition", dp."is_narcotic", dp."requires_refrigeration",
        dp."pack_size", dp."unit_type",
        (
          ts_rank(COALESCE(p."search_vector", ''::tsvector), to_tsquery('english', :tsquery)) * 2.0
          + ts_rank(
            setweight(to_tsvector('english', COALESCE(dp."generic_name", '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(dp."composition", '')), 'B') ||
            setweight(to_tsvector('english', COALESCE(dp."strength", '')), 'C'),
            to_tsquery('english', :tsquery)
          )
        ) AS rank
      FROM "product" p
      LEFT JOIN "drug_product" dp ON dp."product_id" = p."id" AND dp."deleted_at" IS NULL
      WHERE p."deleted_at" IS NULL AND p."status" = 'published'
        AND (
          p."search_vector" @@ to_tsquery('english', :tsquery)
          OR (
            setweight(to_tsvector('english', COALESCE(dp."generic_name", '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(dp."composition", '')), 'B') ||
            setweight(to_tsvector('english', COALESCE(dp."strength", '')), 'C')
          ) @@ to_tsquery('english', :tsquery)
        )
    ),
    ranked AS (
      SELECT *, COUNT(*) OVER() AS total_count FROM fts
      ORDER BY rank DESC, title ASC LIMIT :limit OFFSET :offset
    )
    SELECT r.*,
      pv."id" AS variant_id, pv."title" AS variant_title, pv."sku",
      pma."amount" AS price_amount, pma."currency_code" AS price_currency
    FROM ranked r
    LEFT JOIN LATERAL (
      SELECT v."id", v."title", v."sku" FROM "product_variant" v
      WHERE v."product_id" = r."id" AND v."deleted_at" IS NULL
      ORDER BY v."created_at" ASC LIMIT 1
    ) pv ON true
    LEFT JOIN LATERAL (
      SELECT ma."amount", ma."currency_code"
      FROM "product_variant_price_set" pvps
      JOIN "price" ma ON ma."price_set_id" = pvps."price_set_id"
        AND ma."currency_code" = 'inr' AND ma."deleted_at" IS NULL
      WHERE pvps."variant_id" = pv."id" AND pvps."deleted_at" IS NULL
      LIMIT 1
    ) pma ON true
    ORDER BY rank DESC, title ASC
  `

  try {
    const result = await pgConnection.raw(searchQuery, { tsquery: tsqueryString, limit, offset })
    const rows = result?.rows ?? result?.[0] ?? []
    const totalCount = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0

    const products = rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      title: row.title,
      handle: row.handle,
      thumbnail: row.thumbnail,
      drug_product: row.dp_id ? {
        id: row.dp_id, schedule: row.schedule, generic_name: row.generic_name,
        dosage_form: row.dosage_form, strength: row.strength, composition: row.composition,
        is_narcotic: row.is_narcotic, requires_refrigeration: row.requires_refrigeration,
        pack_size: row.pack_size, unit_type: row.unit_type,
      } : null,
      variant: row.variant_id ? {
        id: row.variant_id, title: row.variant_title, sku: row.sku,
        price: row.price_amount != null ? Number(row.price_amount) : null,
        currency_code: row.price_currency || "inr",
      } : null,
    }))

    return res.json({ products, count: totalCount })
  } catch (error) {
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).error("[pharmacist:products:search] FTS failed:", error)
    return res.status(500).json({ message: "Search failed." })
  }
}
