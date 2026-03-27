import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/analytics/products?view=top_sellers|slow_movers|out_of_stock&limit=20
 *
 * Product performance analytics:
 *  - top_sellers:   highest units sold with revenue
 *  - slow_movers:   products with lowest sales velocity (have stock but barely sell)
 *  - out_of_stock:  products with zero or near-zero inventory
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const view = (req.query.view as string) ?? "top_sellers"
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100)
  const from = (req.query.from as string) ?? ""
  const to = (req.query.to as string) ?? ""

  try {
    let result: { rows: Record<string, unknown>[] }

    switch (view) {
      // ── Top Sellers ────────────────────────────────────────────────
      case "top_sellers": {
        const dateFilter = from && to
          ? `AND o."created_at" >= :from::timestamp AND o."created_at" < (:to::date + INTERVAL '1 day')`
          : ""

        const query = `
          SELECT
            oli."product_id" AS id,
            oli."product_title" AS title,
            oli."product_handle" AS handle,
            oli."thumbnail",
            dp."generic_name",
            dp."schedule",
            dp."dosage_form",
            SUM(oi."quantity")::int AS units_sold,
            COALESCE(SUM(oi."quantity" * oli."unit_price"), 0) AS revenue,
            COUNT(DISTINCT oi."order_id")::int AS order_count
          FROM "order_item" oi
          JOIN "order_line_item" oli ON oli."id" = oi."item_id"
          JOIN "order" o ON o."id" = oi."order_id"
          LEFT JOIN "drug_product" dp ON dp."product_id" = oli."product_id" AND dp."deleted_at" IS NULL
          WHERE o."canceled_at" IS NULL
            AND o."deleted_at" IS NULL
            AND oli."product_id" IS NOT NULL
            ${dateFilter}
          GROUP BY oli."product_id", oli."product_title", oli."product_handle", oli."thumbnail",
                   dp."generic_name", dp."schedule", dp."dosage_form"
          ORDER BY units_sold DESC
          LIMIT :limit
        `

        const bindings: Record<string, unknown> = { limit }
        if (from && to) {
          bindings.from = from
          bindings.to = to
        }

        result = await db.raw(query, bindings)
        break
      }

      // ── Slow Movers ────────────────────────────────────────────────
      case "slow_movers": {
        // Products published for > 7 days with lowest sales velocity
        const query = `
          SELECT
            p."id",
            p."title",
            p."handle",
            p."thumbnail",
            p."created_at" AS listed_at,
            dp."generic_name",
            COALESCE(sales."units_sold", 0)::int AS units_sold,
            COALESCE(sales."revenue", 0) AS revenue,
            EXTRACT(DAY FROM NOW() - p."created_at")::int AS days_listed,
            CASE
              WHEN EXTRACT(DAY FROM NOW() - p."created_at") > 0
              THEN ROUND(COALESCE(sales."units_sold", 0)::numeric
                / EXTRACT(DAY FROM NOW() - p."created_at"), 2)
              ELSE 0
            END AS daily_velocity
          FROM "product" p
          LEFT JOIN "drug_product" dp ON dp."product_id" = p."id" AND dp."deleted_at" IS NULL
          LEFT JOIN LATERAL (
            SELECT
              SUM(oi."quantity") AS units_sold,
              SUM(oi."quantity" * oli."unit_price") AS revenue
            FROM "order_item" oi
            JOIN "order_line_item" oli ON oli."id" = oi."item_id"
            JOIN "order" o ON o."id" = oi."order_id"
            WHERE oli."product_id" = p."id"
              AND o."canceled_at" IS NULL
              AND o."deleted_at" IS NULL
          ) sales ON true
          WHERE p."status" = 'published'
            AND p."deleted_at" IS NULL
            AND p."created_at" < NOW() - INTERVAL '7 days'
          ORDER BY daily_velocity ASC, units_sold ASC
          LIMIT :limit
        `

        result = await db.raw(query, { limit })
        break
      }

      // ── Out of Stock ───────────────────────────────────────────────
      case "out_of_stock": {
        // Products where total inventory_item stocked_quantity is 0 or missing
        const query = `
          SELECT
            p."id",
            p."title",
            p."handle",
            p."thumbnail",
            dp."generic_name",
            dp."schedule",
            COALESCE(inv."total_stock", 0)::int AS total_stock,
            COALESCE(inv."reserved", 0)::int AS reserved_quantity,
            sales."last_sold_at"
          FROM "product" p
          LEFT JOIN "drug_product" dp ON dp."product_id" = p."id" AND dp."deleted_at" IS NULL
          LEFT JOIN LATERAL (
            SELECT
              SUM(il."stocked_quantity") AS total_stock,
              SUM(il."reserved_quantity") AS reserved
            FROM "product_variant" pv
            JOIN "product_variant_inventory_item" pvii ON pvii."variant_id" = pv."id"
            JOIN "inventory_level" il ON il."inventory_item_id" = pvii."inventory_item_id"
            WHERE pv."product_id" = p."id"
              AND pv."deleted_at" IS NULL
          ) inv ON true
          LEFT JOIN LATERAL (
            SELECT MAX(o."created_at") AS last_sold_at
            FROM "order_item" oi
            JOIN "order_line_item" oli ON oli."id" = oi."item_id"
            JOIN "order" o ON o."id" = oi."order_id"
            WHERE oli."product_id" = p."id"
              AND o."canceled_at" IS NULL
          ) sales ON true
          WHERE p."status" = 'published'
            AND p."deleted_at" IS NULL
            AND COALESCE(inv."total_stock", 0) <= 0
          ORDER BY sales."last_sold_at" DESC NULLS LAST
          LIMIT :limit
        `

        result = await db.raw(query, { limit })
        break
      }

      default:
        return res.status(400).json({
          message: `Unknown view: ${view}. Use: top_sellers, slow_movers, out_of_stock`,
        })
    }

    const rows = result.rows ?? (result as any)?.[0] ?? []

    return res.json({
      view,
      count: rows.length,
      products: rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        title: row.title,
        handle: row.handle,
        thumbnail: row.thumbnail,
        generic_name: row.generic_name ?? null,
        schedule: row.schedule ?? null,
        dosage_form: row.dosage_form ?? null,
        units_sold: Number(row.units_sold ?? 0),
        revenue: Number(row.revenue ?? 0),
        order_count: row.order_count != null ? Number(row.order_count) : undefined,
        daily_velocity: row.daily_velocity != null ? Number(row.daily_velocity) : undefined,
        days_listed: row.days_listed != null ? Number(row.days_listed) : undefined,
        total_stock: row.total_stock != null ? Number(row.total_stock) : undefined,
        reserved_quantity: row.reserved_quantity != null ? Number(row.reserved_quantity) : undefined,
        last_sold_at: row.last_sold_at ?? null,
        listed_at: row.listed_at ?? null,
      })),
    })
  } catch (err) {
    logger.error(`[analytics:products] Query failed: ${(err as Error).message}`)
    return res.status(500).json({
      message: "Failed to query product analytics",
    })
  }
}
