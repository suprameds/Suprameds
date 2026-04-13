import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/analytics/inventory
 *
 * Inventory health:
 *  - Total SKUs, in-stock, low-stock, out-of-stock counts
 *  - Batches expiring within 30/60/90 days
 *  - Recalled batches
 *  - Recent GRN activity
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    // ── 1. Stock health summary ───────────────────────────────────
    const stockQuery = `
      WITH variant_stock AS (
        SELECT
          b."product_variant_id",
          SUM(b."available_quantity") AS total_available
        FROM "batch" b
        WHERE b."status" = 'active'
          AND b."deleted_at" IS NULL
        GROUP BY b."product_variant_id"
      )
      SELECT
        COUNT(DISTINCT pv."id") AS total_variants,
        COUNT(DISTINCT pv."id") FILTER (WHERE COALESCE(vs.total_available, 0) > 10) AS in_stock,
        COUNT(DISTINCT pv."id") FILTER (WHERE COALESCE(vs.total_available, 0) BETWEEN 1 AND 10) AS low_stock,
        COUNT(DISTINCT pv."id") FILTER (WHERE COALESCE(vs.total_available, 0) = 0) AS out_of_stock
      FROM "product_variant" pv
      JOIN "product" p ON p."id" = pv."product_id" AND p."deleted_at" IS NULL
      LEFT JOIN variant_stock vs ON vs."product_variant_id" = pv."id"
      WHERE pv."deleted_at" IS NULL
    `

    // ── 2. Batch expiry alerts ────────────────────────────────────
    const expiryQuery = `
      SELECT
        COUNT(*) FILTER (WHERE b."expiry_date" < NOW()) AS expired,
        COUNT(*) FILTER (
          WHERE b."expiry_date" >= NOW() AND b."expiry_date" < NOW() + INTERVAL '30 days'
        ) AS expiring_30d,
        COUNT(*) FILTER (
          WHERE b."expiry_date" >= NOW() + INTERVAL '30 days'
            AND b."expiry_date" < NOW() + INTERVAL '60 days'
        ) AS expiring_60d,
        COUNT(*) FILTER (
          WHERE b."expiry_date" >= NOW() + INTERVAL '60 days'
            AND b."expiry_date" < NOW() + INTERVAL '90 days'
        ) AS expiring_90d,
        COUNT(*) FILTER (WHERE b."status" = 'recalled') AS recalled,
        COUNT(*) FILTER (WHERE b."status" = 'quarantine') AS quarantine
      FROM "batch" b
      WHERE b."deleted_at" IS NULL
        AND b."available_quantity" > 0
    `

    // ── 3. Top expiring batches (soonest, active, with stock) ─────
    const topExpiringQuery = `
      SELECT
        b."id" AS batch_id,
        b."lot_number",
        b."expiry_date",
        b."available_quantity",
        p."title" AS product_title,
        dp."generic_name",
        dp."schedule"
      FROM "batch" b
      JOIN "product_variant" pv ON pv."id" = b."product_variant_id"
      JOIN "product" p ON p."id" = pv."product_id"
      LEFT JOIN "drug_product" dp ON dp."product_id" = p."id"
      WHERE b."status" = 'active'
        AND b."deleted_at" IS NULL
        AND b."available_quantity" > 0
        AND b."expiry_date" < NOW() + INTERVAL '90 days'
      ORDER BY b."expiry_date" ASC
      LIMIT 10
    `

    // ── 4. Recent GRN activity (last 30 days) ─────────────────────
    const grnQuery = `
      SELECT
        COUNT(*) AS total_grns,
        COUNT(*) FILTER (WHERE g."status" = 'approved') AS approved,
        COUNT(*) FILTER (WHERE g."status" = 'pending_qc') AS pending_qc,
        COUNT(*) FILTER (WHERE g."status" = 'rejected' OR g."status" = 'partially_rejected') AS rejected
      FROM "grn_record" g
      WHERE g."created_at" >= NOW() - INTERVAL '30 days'
    `

    const [stockResult, expiryResult, topExpiringResult, grnResult] = await Promise.all([
      db.raw(stockQuery).catch(() => ({ rows: [] })),
      db.raw(expiryQuery).catch(() => ({ rows: [] })),
      db.raw(topExpiringQuery).catch(() => ({ rows: [] })),
      db.raw(grnQuery).catch(() => ({ rows: [] })),
    ])

    const stock = stockResult.rows?.[0] ?? stockResult?.[0]?.[0] ?? {}
    const expiry = expiryResult.rows?.[0] ?? expiryResult?.[0]?.[0] ?? {}
    const grn = grnResult.rows?.[0] ?? grnResult?.[0]?.[0] ?? {}

    return res.json({
      stock_health: {
        total_variants: Number(stock.total_variants ?? 0),
        in_stock: Number(stock.in_stock ?? 0),
        low_stock: Number(stock.low_stock ?? 0),
        out_of_stock: Number(stock.out_of_stock ?? 0),
      },
      batch_alerts: {
        expired: Number(expiry.expired ?? 0),
        expiring_30d: Number(expiry.expiring_30d ?? 0),
        expiring_60d: Number(expiry.expiring_60d ?? 0),
        expiring_90d: Number(expiry.expiring_90d ?? 0),
        recalled: Number(expiry.recalled ?? 0),
        quarantine: Number(expiry.quarantine ?? 0),
      },
      top_expiring_batches: (topExpiringResult.rows ?? topExpiringResult?.[0] ?? []).map(
        (row: Record<string, unknown>) => ({
          batch_id: row.batch_id,
          lot_number: row.lot_number,
          expiry_date: row.expiry_date,
          available_quantity: Number(row.available_quantity),
          product_title: row.product_title,
          generic_name: row.generic_name,
          schedule: row.schedule,
        })
      ),
      grn_activity: {
        total: Number(grn.total_grns ?? 0),
        approved: Number(grn.approved ?? 0),
        pending_qc: Number(grn.pending_qc ?? 0),
        rejected: Number(grn.rejected ?? 0),
      },
    })
  } catch (err) {
    logger.error(`[analytics:inventory] Query failed: ${(err as Error).message}`)
    return res.status(500).json({ message: "Failed to query inventory analytics" })
  }
}
