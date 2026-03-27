import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/analytics?type=dashboard
 *
 * Returns a comprehensive dashboard overview:
 *  - Order counts (today, this week, this month)
 *  - Revenue totals (today, week, month)
 *  - Average order value
 *  - Top 5 selling products
 *  - Order status distribution
 *  - Payment method split (Razorpay vs COD)
 *  - Prescription vs OTC order ratio
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const type = (req.query.type as string) ?? "dashboard"

  if (type !== "dashboard") {
    return res.status(400).json({ message: `Unknown analytics type: ${type}` })
  }

  try {
    // IST offset for "today" boundaries (UTC+5:30)
    const IST_OFFSET = "'+5 hours 30 minutes'"

    // ── 1. Order counts & revenue by period ────────────────────────
    // Medusa v2: order totals are in order_summary.totals JSON, not on the order table
    const orderStatsQuery = `
      SELECT
        COUNT(*) FILTER (
          WHERE o."created_at" >= (NOW() AT TIME ZONE 'UTC' + INTERVAL ${IST_OFFSET})::date
            - INTERVAL ${IST_OFFSET}
        ) AS orders_today,

        COUNT(*) FILTER (
          WHERE o."created_at" >= date_trunc('week', (NOW() AT TIME ZONE 'UTC' + INTERVAL ${IST_OFFSET})::date)
            - INTERVAL ${IST_OFFSET}
        ) AS orders_this_week,

        COUNT(*) FILTER (
          WHERE o."created_at" >= date_trunc('month', (NOW() AT TIME ZONE 'UTC' + INTERVAL ${IST_OFFSET})::date)
            - INTERVAL ${IST_OFFSET}
        ) AS orders_this_month,

        COALESCE(SUM((os."totals"->>'current_order_total')::numeric) FILTER (
          WHERE o."created_at" >= (NOW() AT TIME ZONE 'UTC' + INTERVAL ${IST_OFFSET})::date
            - INTERVAL ${IST_OFFSET}
        ), 0) AS revenue_today,

        COALESCE(SUM((os."totals"->>'current_order_total')::numeric) FILTER (
          WHERE o."created_at" >= date_trunc('week', (NOW() AT TIME ZONE 'UTC' + INTERVAL ${IST_OFFSET})::date)
            - INTERVAL ${IST_OFFSET}
        ), 0) AS revenue_this_week,

        COALESCE(SUM((os."totals"->>'current_order_total')::numeric) FILTER (
          WHERE o."created_at" >= date_trunc('month', (NOW() AT TIME ZONE 'UTC' + INTERVAL ${IST_OFFSET})::date)
            - INTERVAL ${IST_OFFSET}
        ), 0) AS revenue_this_month,

        COUNT(*) AS total_orders,
        COALESCE(SUM((os."totals"->>'current_order_total')::numeric), 0) AS total_revenue,
        COALESCE(AVG((os."totals"->>'current_order_total')::numeric), 0) AS avg_order_value
      FROM "order" o
      LEFT JOIN "order_summary" os ON os."order_id" = o."id"
      WHERE o."canceled_at" IS NULL
        AND o."deleted_at" IS NULL
        AND os."version" = (SELECT MAX(os2."version") FROM "order_summary" os2 WHERE os2."order_id" = o."id")
    `

    // ── 2. Top 5 selling products ──────────────────────────────────
    // Medusa v2: order_item has quantity, order_line_item has product info
    const topProductsQuery = `
      SELECT
        oli."product_id" AS id,
        oli."product_title" AS title,
        oli."thumbnail",
        SUM(oi."quantity") AS units_sold,
        SUM(oi."quantity" * oli."unit_price") AS revenue
      FROM "order_item" oi
      JOIN "order_line_item" oli ON oli."id" = oi."item_id"
      JOIN "order" o ON o."id" = oi."order_id"
      WHERE o."canceled_at" IS NULL
        AND o."deleted_at" IS NULL
        AND oli."product_id" IS NOT NULL
      GROUP BY oli."product_id", oli."product_title", oli."thumbnail"
      ORDER BY units_sold DESC
      LIMIT 5
    `

    // ── 3. Order status distribution ───────────────────────────────
    const statusDistQuery = `
      SELECT
        COALESCE(o."status"::text, 'unknown') AS status,
        COUNT(*) AS count
      FROM "order" o
      WHERE o."deleted_at" IS NULL
      GROUP BY o."status"
      ORDER BY count DESC
    `

    // ── 4. Payment method split ────────────────────────────────────
    const paymentSplitQuery = `
      SELECT
        CASE
          WHEN pp."id" ILIKE '%razorpay%' THEN 'razorpay'
          WHEN pp."id" ILIKE '%cod%' OR pp."id" ILIKE '%cash%' THEN 'cod'
          WHEN pp."id" ILIKE '%system%' THEN 'system_default'
          ELSE COALESCE(pp."id", 'unknown')
        END AS method,
        COUNT(DISTINCT o."id") AS order_count,
        COALESCE(SUM((os."totals"->>'current_order_total')::numeric), 0) AS revenue
      FROM "order" o
      LEFT JOIN "order_summary" os ON os."order_id" = o."id"
        AND os."version" = (SELECT MAX(os2."version") FROM "order_summary" os2 WHERE os2."order_id" = o."id")
      LEFT JOIN "order_payment_collection" opc ON opc."order_id" = o."id"
      LEFT JOIN "payment_collection" pc ON pc."id" = opc."payment_collection_id"
      LEFT JOIN "payment" p ON p."payment_collection_id" = pc."id"
      LEFT JOIN "payment_provider" pp ON pp."id" = p."provider_id"
      WHERE o."canceled_at" IS NULL
        AND o."deleted_at" IS NULL
      GROUP BY method
      ORDER BY order_count DESC
    `

    // ── 5. Prescription vs OTC ratio ───────────────────────────────
    // Uses pharmaOrder extension table — requires_prescription flag on items
    const rxOtcQuery = `
      SELECT
        CASE
          WHEN oe."is_rx_order" = true THEN 'prescription'
          ELSE 'otc'
        END AS order_type,
        COUNT(*) AS count
      FROM "order_extension" oe
      GROUP BY order_type
    `

    // Run all queries in parallel
    const [
      orderStatsResult,
      topProductsResult,
      statusDistResult,
      paymentSplitResult,
      rxOtcResult,
    ] = await Promise.all([
      db.raw(orderStatsQuery),
      db.raw(topProductsQuery),
      db.raw(statusDistQuery),
      db.raw(paymentSplitQuery),
      db.raw(rxOtcQuery).catch(() => ({ rows: [] })), // Graceful fallback if table doesn't exist
    ])

    const stats = orderStatsResult.rows?.[0] ?? orderStatsResult?.[0]?.[0] ?? {}

    const topProducts = (topProductsResult.rows ?? topProductsResult?.[0] ?? []).map(
      (row: Record<string, unknown>) => ({
        id: row.id,
        title: row.title,
        thumbnail: row.thumbnail,
        units_sold: Number(row.units_sold),
        revenue: Number(row.revenue),
      })
    )

    const statusDistribution = Object.fromEntries(
      (statusDistResult.rows ?? statusDistResult?.[0] ?? []).map(
        (row: Record<string, unknown>) => [row.status, Number(row.count)]
      )
    )

    const paymentMethods = (paymentSplitResult.rows ?? paymentSplitResult?.[0] ?? []).map(
      (row: Record<string, unknown>) => ({
        method: row.method,
        order_count: Number(row.order_count),
        revenue: Number(row.revenue),
      })
    )

    const rxOtcRatio = Object.fromEntries(
      (rxOtcResult.rows ?? rxOtcResult?.[0] ?? []).map(
        (row: Record<string, unknown>) => [row.order_type, Number(row.count)]
      )
    )

    return res.json({
      type: "dashboard",
      generated_at: new Date().toISOString(),
      orders: {
        today: Number(stats.orders_today ?? 0),
        this_week: Number(stats.orders_this_week ?? 0),
        this_month: Number(stats.orders_this_month ?? 0),
        total: Number(stats.total_orders ?? 0),
      },
      revenue: {
        today: Number(stats.revenue_today ?? 0),
        this_week: Number(stats.revenue_this_week ?? 0),
        this_month: Number(stats.revenue_this_month ?? 0),
        total: Number(stats.total_revenue ?? 0),
        currency_code: "inr",
      },
      avg_order_value: Number(stats.avg_order_value ?? 0),
      top_products: topProducts,
      status_distribution: statusDistribution,
      payment_methods: paymentMethods,
      rx_otc_ratio: rxOtcRatio,
    })
  } catch (err) {
    logger.error(`[analytics] Dashboard query failed: ${(err as Error).message}`)
    return res.status(500).json({
      message: "Failed to generate analytics dashboard",
    })
  }
}
