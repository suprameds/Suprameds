import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { InspectReturnWorkflow } from "../../../../workflows/warehouse/inspect-return"

/**
 * GET /admin/orders/returns?status=requested&order_id=xxx&from=2026-03-01&to=2026-03-21
 *
 * Lists return requests with optional filters.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { status, order_id, from, to, limit, offset } = req.query as Record<string, string>

    const filters: Record<string, any> = {}
    if (status) filters.status = status
    if (order_id) filters.order_id = order_id

    // Date range filter on created_at
    if (from || to) {
      filters.created_at = {}
      if (from) filters.created_at.$gte = new Date(from).toISOString()
      if (to) filters.created_at.$lte = new Date(to).toISOString()
    }

    const take = Math.min(Number(limit) || 50, 100)
    const skip = Number(offset) || 0

    const { data: returns } = await query.graph({
      entity: "return",
      fields: [
        "id",
        "status",
        "order_id",
        "created_at",
        "updated_at",
        "items.id",
        "items.item_id",
        "items.quantity",
        "items.reason_id",
        "items.note",
      ],
      filters,
      pagination: { take, skip, order: { created_at: "DESC" } },
    }) as any

    logger.info(`[admin:returns] Listed ${(returns as any[])?.length ?? 0} returns`)

    return res.json({
      returns,
      count: (returns as any[])?.length ?? 0,
      limit: take,
      offset: skip,
    })
  } catch (err: any) {
    logger.error(`[admin:returns] GET failed: ${err.message}`)
    return res.status(400).json({ message: err.message || "Failed to list returns" })
  }
}

/**
 * POST /admin/orders/returns
 *
 * Process a return inspection by running the InspectReturnWorkflow.
 *
 * Body:
 * {
 *   return_id: string,
 *   order_id: string,
 *   inspector_id: string,
 *   inspection_result: "approved" | "rejected" | "partial",
 *   items: [
 *     {
 *       line_item_id: string,
 *       quantity_returned: number,
 *       condition: "sealed" | "damaged" | "wrong_item" | "expired",
 *       accepted: boolean
 *     }
 *   ]
 * }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const body = req.body as Record<string, any>

  // ── Validate required fields ──────────────────────────────────────
  const required = ["return_id", "order_id", "inspector_id", "inspection_result", "items"]
  const missing = required.filter((f) => !body[f])
  if (missing.length) {
    return res.status(400).json({
      message: `Missing required fields: ${missing.join(", ")}`,
    })
  }

  const validResults = ["approved", "rejected", "partial"]
  if (!validResults.includes(body.inspection_result)) {
    return res.status(400).json({
      message: `inspection_result must be one of: ${validResults.join(", ")}`,
    })
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ message: "items must be a non-empty array" })
  }

  const validConditions = ["sealed", "damaged", "wrong_item", "expired"]
  for (const item of body.items) {
    if (!item.line_item_id || !item.quantity_returned || !item.condition) {
      return res.status(400).json({
        message: "Each item requires: line_item_id, quantity_returned, condition",
      })
    }
    if (!validConditions.includes(item.condition)) {
      return res.status(400).json({
        message: `Item condition must be one of: ${validConditions.join(", ")}`,
      })
    }
    // Default accepted to true if not explicitly set
    if (item.accepted === undefined) item.accepted = true
  }

  // ── Run the inspection workflow ───────────────────────────────────
  try {
    logger.info(
      `[admin:returns] Processing inspection for return ${body.return_id}, ` +
        `${body.items.length} item(s), result: ${body.inspection_result}`
    )

    const { result } = await InspectReturnWorkflow(req.scope).run({
      input: {
        return_id: body.return_id,
        order_id: body.order_id,
        inspector_id: body.inspector_id,
        inspection_result: body.inspection_result,
        items: body.items.map((i: any) => ({
          line_item_id: i.line_item_id,
          quantity_returned: Number(i.quantity_returned),
          condition: i.condition,
          accepted: Boolean(i.accepted),
        })),
      },
    })

    logger.info(
      `[admin:returns] Inspection completed for return ${body.return_id}: ` +
        `${result.accepted_count} accepted, ${result.rejected_count} rejected`
    )

    return res.status(200).json({ inspection: result })
  } catch (err: any) {
    logger.error(`[admin:returns] POST failed: ${err.message}`)
    return res.status(400).json({
      message: err.message || "Failed to process return inspection",
    })
  }
}
