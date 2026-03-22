import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/analytics/revenue?from=2026-01-01&to=2026-03-21&granularity=day
 *
 * Revenue trends broken down by day, week, or month within a date range.
 * Returns an array of { period, order_count, revenue, avg_order_value }.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const from = (req.query.from as string) ?? ""
  const to = (req.query.to as string) ?? ""
  const granularity = (req.query.granularity as string) ?? "day"

  if (!from || !to) {
    return res.status(400).json({
      message: "Query parameters 'from' and 'to' are required (YYYY-MM-DD format)",
    })
  }

  if (!["day", "week", "month"].includes(granularity)) {
    return res.status(400).json({
      message: "granularity must be one of: day, week, month",
    })
  }

  // Postgres date_trunc accepts 'day', 'week', 'month' directly
  const truncUnit = granularity

  try {
    const query = `
      SELECT
        date_trunc(:truncUnit, o."created_at")::date AS period,
        COUNT(*)::int AS order_count,
        COALESCE(SUM(o."total"), 0) AS revenue,
        COALESCE(AVG(o."total"), 0) AS avg_order_value,
        COALESCE(SUM(o."subtotal"), 0) AS subtotal,
        COALESCE(SUM(o."tax_total"), 0) AS tax_total,
        COALESCE(SUM(o."shipping_total"), 0) AS shipping_total,
        COALESCE(SUM(o."discount_total"), 0) AS discount_total
      FROM "order" o
      WHERE o."canceled_at" IS NULL
        AND o."deleted_at" IS NULL
        AND o."created_at" >= :from::timestamp
        AND o."created_at" < (:to::date + INTERVAL '1 day')
      GROUP BY period
      ORDER BY period ASC
    `

    const result = await db.raw(query, { truncUnit, from, to })
    const rows = result.rows ?? result?.[0] ?? []

    // Also compute totals for the entire range
    const totals = rows.reduce(
      (acc: Record<string, number>, row: Record<string, unknown>) => {
        acc.order_count += Number(row.order_count)
        acc.revenue += Number(row.revenue)
        acc.tax_total += Number(row.tax_total)
        acc.shipping_total += Number(row.shipping_total)
        acc.discount_total += Number(row.discount_total)
        return acc
      },
      { order_count: 0, revenue: 0, tax_total: 0, shipping_total: 0, discount_total: 0 }
    )

    return res.json({
      from,
      to,
      granularity,
      currency_code: "inr",
      totals: {
        ...totals,
        avg_order_value: totals.order_count > 0 ? Math.round(totals.revenue / totals.order_count) : 0,
      },
      data: rows.map((row: Record<string, unknown>) => ({
        period: row.period,
        order_count: Number(row.order_count),
        revenue: Number(row.revenue),
        avg_order_value: Math.round(Number(row.avg_order_value)),
        subtotal: Number(row.subtotal),
        tax_total: Number(row.tax_total),
        shipping_total: Number(row.shipping_total),
        discount_total: Number(row.discount_total),
      })),
    })
  } catch (err) {
    logger.error(`[analytics:revenue] Query failed: ${(err as Error).message}`)
    return res.status(500).json({
      message: "Failed to query revenue analytics",
      error: (err as Error).message,
    })
  }
}
