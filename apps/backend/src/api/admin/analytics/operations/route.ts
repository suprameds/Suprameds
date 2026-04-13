import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/analytics/operations
 *
 * Operational metrics:
 *  - COD confirmation rate, pending count, RTO rate
 *  - Fulfillment velocity: avg dispatch time, pending dispatch, NDR rate
 *  - Dispatch pipeline: orders by pharma status
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    // ── 1. COD analytics ──────────────────────────────────────────
    const codQuery = `
      SELECT
        COUNT(*) AS total_cod_orders,
        COUNT(*) FILTER (WHERE co."status" = 'confirmed') AS confirmed,
        COUNT(*) FILTER (WHERE co."status" = 'pending_confirmation') AS pending_confirmation,
        COUNT(*) FILTER (WHERE co."status" = 'cancelled') AS cancelled,
        COUNT(*) FILTER (WHERE co."status" = 'rto') AS rto,
        CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE co."status" = 'confirmed')::numeric / COUNT(*)::numeric * 100, 1)
          ELSE 0
        END AS confirmation_rate,
        CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE co."status" = 'rto')::numeric / COUNT(*)::numeric * 100, 1)
          ELSE 0
        END AS rto_rate
      FROM "cod_order" co
    `

    // ── 2. Fulfillment velocity ───────────────────────────────────
    const fulfillmentQuery = `
      SELECT
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (s."dispatched_at" - o."created_at")) / 3600)
          FILTER (WHERE s."dispatched_at" IS NOT NULL),
          0
        ) AS avg_dispatch_hours,
        COUNT(*) FILTER (WHERE s."status" = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE s."status" = 'in_transit') AS in_transit,
        COUNT(*) FILTER (WHERE s."status" = 'out_for_delivery') AS out_for_delivery,
        COUNT(*) FILTER (WHERE s."status" = 'ndr') AS ndr,
        COUNT(*) FILTER (WHERE s."status" = 'rto_initiated' OR s."status" = 'rto_delivered') AS rto,
        COUNT(*) FILTER (WHERE s."status" = 'label_created') AS pending_dispatch,
        COUNT(*) AS total_shipments,
        CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE s."status" = 'delivered')::numeric / COUNT(*)::numeric * 100, 1)
          ELSE 0
        END AS delivery_success_rate
      FROM "shipment" s
      LEFT JOIN "order" o ON o."id" = s."order_id"
    `

    // ── 3. Pharma order pipeline (order_extension status counts) ──
    const pipelineQuery = `
      SELECT
        oe."status",
        COUNT(*)::int AS count
      FROM "order_extension" oe
      GROUP BY oe."status"
      ORDER BY count DESC
    `

    // ── 4. Pending dispatch sign-offs ─────────────────────────────
    const signoffQuery = `
      SELECT
        COUNT(*) FILTER (WHERE pdso."approved" = true) AS approved_signoffs,
        COUNT(*) FILTER (WHERE pdso."approved" = false) AS rejected_signoffs,
        COUNT(*) AS total_signoffs
      FROM "pre_dispatch_sign_off" pdso
    `

    const [codResult, fulfillmentResult, pipelineResult, signoffResult] = await Promise.all([
      db.raw(codQuery).catch(() => ({ rows: [] })),
      db.raw(fulfillmentQuery).catch(() => ({ rows: [] })),
      db.raw(pipelineQuery).catch(() => ({ rows: [] })),
      db.raw(signoffQuery).catch(() => ({ rows: [] })),
    ])

    const cod = codResult.rows?.[0] ?? codResult?.[0]?.[0] ?? {}
    const fulfillment = fulfillmentResult.rows?.[0] ?? fulfillmentResult?.[0]?.[0] ?? {}
    const signoff = signoffResult.rows?.[0] ?? signoffResult?.[0]?.[0] ?? {}

    const pipeline = Object.fromEntries(
      (pipelineResult.rows ?? pipelineResult?.[0] ?? []).map(
        (row: Record<string, unknown>) => [row.status, Number(row.count)]
      )
    )

    return res.json({
      cod: {
        total_orders: Number(cod.total_cod_orders ?? 0),
        confirmed: Number(cod.confirmed ?? 0),
        pending_confirmation: Number(cod.pending_confirmation ?? 0),
        cancelled: Number(cod.cancelled ?? 0),
        rto: Number(cod.rto ?? 0),
        confirmation_rate: Number(cod.confirmation_rate ?? 0),
        rto_rate: Number(cod.rto_rate ?? 0),
      },
      fulfillment: {
        avg_dispatch_hours: Number(Number(fulfillment.avg_dispatch_hours ?? 0).toFixed(1)),
        delivered: Number(fulfillment.delivered ?? 0),
        in_transit: Number(fulfillment.in_transit ?? 0),
        out_for_delivery: Number(fulfillment.out_for_delivery ?? 0),
        ndr: Number(fulfillment.ndr ?? 0),
        rto: Number(fulfillment.rto ?? 0),
        pending_dispatch: Number(fulfillment.pending_dispatch ?? 0),
        total_shipments: Number(fulfillment.total_shipments ?? 0),
        delivery_success_rate: Number(fulfillment.delivery_success_rate ?? 0),
      },
      pharma_pipeline: pipeline,
      dispatch_signoffs: {
        approved: Number(signoff.approved_signoffs ?? 0),
        rejected: Number(signoff.rejected_signoffs ?? 0),
        total: Number(signoff.total_signoffs ?? 0),
      },
    })
  } catch (err) {
    logger.error(`[analytics:operations] Query failed: ${(err as Error).message}`)
    return res.status(500).json({ message: "Failed to query operations analytics" })
  }
}
