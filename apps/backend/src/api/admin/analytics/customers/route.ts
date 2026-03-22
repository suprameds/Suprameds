import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/analytics/customers?from=2026-01-01&to=2026-03-21
 *
 * Customer analytics:
 *  - New vs returning customer split
 *  - Geographic distribution (top cities/states)
 *  - Customer lifetime value (LTV) percentiles
 *  - Registration trend over time
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const from = (req.query.from as string) ?? ""
  const to = (req.query.to as string) ?? ""

  try {
    // ── 1. New vs returning customers ────────────────────────────────
    // "New" = first order within the date range; "Returning" = had an order before `from`
    const dateFilter = from && to
      ? `AND o."created_at" >= :from::timestamp AND o."created_at" < (:to::date + INTERVAL '1 day')`
      : ""

    const newVsReturningQuery = `
      WITH customer_orders AS (
        SELECT
          o."customer_id",
          MIN(o."created_at") AS first_order_at,
          COUNT(*)::int AS order_count
        FROM "order" o
        WHERE o."customer_id" IS NOT NULL
          AND o."canceled_at" IS NULL
          AND o."deleted_at" IS NULL
        GROUP BY o."customer_id"
      ),
      period_customers AS (
        SELECT DISTINCT o."customer_id"
        FROM "order" o
        WHERE o."customer_id" IS NOT NULL
          AND o."canceled_at" IS NULL
          AND o."deleted_at" IS NULL
          ${dateFilter}
      )
      SELECT
        COUNT(*) FILTER (
          WHERE co."first_order_at" >= ${from ? ':from::timestamp' : 'NOW() - INTERVAL \'30 days\''}
        ) AS new_customers,
        COUNT(*) FILTER (
          WHERE co."first_order_at" < ${from ? ':from::timestamp' : 'NOW() - INTERVAL \'30 days\''}
        ) AS returning_customers,
        COUNT(*) AS total_active_customers
      FROM period_customers pc
      JOIN customer_orders co ON co."customer_id" = pc."customer_id"
    `

    // ── 2. Geographic distribution (top 15 cities by order volume) ──
    const geoQuery = `
      SELECT
        COALESCE(sa."city", 'Unknown') AS city,
        COALESCE(sa."province", '') AS state,
        COUNT(DISTINCT o."id")::int AS order_count,
        COUNT(DISTINCT o."customer_id")::int AS customer_count,
        COALESCE(SUM(o."total"), 0) AS revenue
      FROM "order" o
      LEFT JOIN "order_address" sa
        ON sa."id" = o."shipping_address_id"
      WHERE o."canceled_at" IS NULL
        AND o."deleted_at" IS NULL
        ${dateFilter}
      GROUP BY city, state
      ORDER BY order_count DESC
      LIMIT 15
    `

    // ── 3. Customer LTV distribution ─────────────────────────────────
    const ltvQuery = `
      WITH ltv AS (
        SELECT
          o."customer_id",
          COUNT(*)::int AS total_orders,
          COALESCE(SUM(o."total"), 0) AS lifetime_value,
          MIN(o."created_at") AS first_order,
          MAX(o."created_at") AS last_order
        FROM "order" o
        WHERE o."customer_id" IS NOT NULL
          AND o."canceled_at" IS NULL
          AND o."deleted_at" IS NULL
        GROUP BY o."customer_id"
      )
      SELECT
        COUNT(*) AS total_customers,
        COALESCE(AVG(lifetime_value), 0) AS avg_ltv,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lifetime_value), 0) AS median_ltv,
        COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY lifetime_value), 0) AS p90_ltv,
        COALESCE(MAX(lifetime_value), 0) AS max_ltv,
        COALESCE(AVG(total_orders), 0) AS avg_orders_per_customer,
        COUNT(*) FILTER (WHERE total_orders = 1) AS single_order_customers,
        COUNT(*) FILTER (WHERE total_orders >= 2) AS repeat_customers,
        COUNT(*) FILTER (WHERE total_orders >= 5) AS loyal_customers
      FROM ltv
    `

    // ── 4. Customer registration trend (monthly) ─────────────────────
    const registrationQuery = `
      SELECT
        date_trunc('month', c."created_at")::date AS month,
        COUNT(*)::int AS registrations
      FROM "customer" c
      WHERE c."deleted_at" IS NULL
        AND c."created_at" >= COALESCE(:from::timestamp, NOW() - INTERVAL '12 months')
        AND c."created_at" < COALESCE((:to::date + INTERVAL '1 day'), NOW() + INTERVAL '1 day')
      GROUP BY month
      ORDER BY month ASC
    `

    // ── 5. Top customers by LTV ──────────────────────────────────────
    const topCustomersQuery = `
      SELECT
        o."customer_id",
        c."first_name",
        c."last_name",
        c."email",
        c."phone",
        COUNT(DISTINCT o."id")::int AS total_orders,
        COALESCE(SUM(o."total"), 0) AS lifetime_value,
        MIN(o."created_at") AS first_order,
        MAX(o."created_at") AS last_order
      FROM "order" o
      JOIN "customer" c ON c."id" = o."customer_id"
      WHERE o."customer_id" IS NOT NULL
        AND o."canceled_at" IS NULL
        AND o."deleted_at" IS NULL
      GROUP BY o."customer_id", c."first_name", c."last_name", c."email", c."phone"
      ORDER BY lifetime_value DESC
      LIMIT 10
    `

    const bindings: Record<string, unknown> = {}
    if (from) bindings.from = from
    if (to) bindings.to = to

    const [
      newVsReturningResult,
      geoResult,
      ltvResult,
      registrationResult,
      topCustomersResult,
    ] = await Promise.all([
      db.raw(newVsReturningQuery, bindings),
      db.raw(geoQuery, bindings),
      db.raw(ltvQuery),
      db.raw(registrationQuery, { from: from || null, to: to || null }),
      db.raw(topCustomersQuery),
    ])

    const newVsReturning = newVsReturningResult.rows?.[0] ?? newVsReturningResult?.[0]?.[0] ?? {}
    const ltvStats = ltvResult.rows?.[0] ?? ltvResult?.[0]?.[0] ?? {}

    return res.json({
      period: { from: from || null, to: to || null },
      currency_code: "inr",

      new_vs_returning: {
        new_customers: Number(newVsReturning.new_customers ?? 0),
        returning_customers: Number(newVsReturning.returning_customers ?? 0),
        total_active: Number(newVsReturning.total_active_customers ?? 0),
      },

      geographic_distribution: (geoResult.rows ?? geoResult?.[0] ?? []).map(
        (row: Record<string, unknown>) => ({
          city: row.city,
          state: row.state,
          order_count: Number(row.order_count),
          customer_count: Number(row.customer_count),
          revenue: Number(row.revenue),
        })
      ),

      lifetime_value: {
        total_customers: Number(ltvStats.total_customers ?? 0),
        avg_ltv: Math.round(Number(ltvStats.avg_ltv ?? 0)),
        median_ltv: Math.round(Number(ltvStats.median_ltv ?? 0)),
        p90_ltv: Math.round(Number(ltvStats.p90_ltv ?? 0)),
        max_ltv: Math.round(Number(ltvStats.max_ltv ?? 0)),
        avg_orders_per_customer: Number(Number(ltvStats.avg_orders_per_customer ?? 0).toFixed(1)),
        single_order_customers: Number(ltvStats.single_order_customers ?? 0),
        repeat_customers: Number(ltvStats.repeat_customers ?? 0),
        loyal_customers: Number(ltvStats.loyal_customers ?? 0),
      },

      registration_trend: (registrationResult.rows ?? registrationResult?.[0] ?? []).map(
        (row: Record<string, unknown>) => ({
          month: row.month,
          registrations: Number(row.registrations),
        })
      ),

      top_customers: (topCustomersResult.rows ?? topCustomersResult?.[0] ?? []).map(
        (row: Record<string, unknown>) => ({
          customer_id: row.customer_id,
          name: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Guest",
          email: row.email,
          phone: row.phone,
          total_orders: Number(row.total_orders),
          lifetime_value: Number(row.lifetime_value),
          first_order: row.first_order,
          last_order: row.last_order,
        })
      ),
    })
  } catch (err) {
    logger.error(`[analytics:customers] Query failed: ${(err as Error).message}`)
    return res.status(500).json({
      message: "Failed to query customer analytics",
      error: (err as Error).message,
    })
  }
}
