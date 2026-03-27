import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { WAREHOUSE_MODULE } from "../../../../modules/warehouse"
import { InspectReturnWorkflow } from "../../../../workflows/warehouse/inspect-return"

/**
 * GET /admin/warehouse/returns
 * Lists returns inspections awaiting physical inspection (status = "pending").
 *
 * POST /admin/warehouse/returns
 * Submit an inspection result for a returned order.
 * Body: {
 *   return_id: string,
 *   order_id: string,
 *   inspection_lines: [{ item_id, condition: "sealed"|"damaged"|"wrong_item"|"expired", accept: boolean }],
 *   notes?: string
 * }
 */

const VALID_CONDITIONS = ["sealed", "damaged", "wrong_item", "expired"] as const
type ItemCondition = (typeof VALID_CONDITIONS)[number]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const warehouseService = req.scope.resolve(WAREHOUSE_MODULE) as any

    const {
      limit: limitStr,
      offset: offsetStr,
    } = req.query as Record<string, string>

    const limit = Number(limitStr) || 20
    const offset = Number(offsetStr) || 0

    const inspections = await warehouseService.listReturnsInspections(
      { status: "pending" } as Record<string, any>,
      { take: limit, skip: offset, order: { created_at: "ASC" } }
    )

    const list: any[] = Array.isArray(inspections?.[0])
      ? inspections[0]
      : Array.isArray(inspections)
      ? inspections
      : []

    return res.json({ data: list, count: list.length, limit, offset })
  } catch (err: any) {
    console.error("[admin:warehouse:returns] GET failed:", err?.message)
    return res.status(500).json({ error: "Failed to fetch pending returns" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as Record<string, any>
  const actorId = (req as any).auth_context?.actor_id || "unknown"

  if (!body.return_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "return_id is required")
  }

  if (!body.order_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "order_id is required")
  }

  if (!Array.isArray(body.inspection_lines) || body.inspection_lines.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "inspection_lines[] is required and must not be empty"
    )
  }

  // Validate each inspection line
  for (const line of body.inspection_lines) {
    if (!line.item_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Each inspection line requires item_id")
    }
    if (!VALID_CONDITIONS.includes(line.condition as ItemCondition)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `condition must be one of: ${VALID_CONDITIONS.join(", ")}`
      )
    }
    if (typeof line.accept !== "boolean") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Each inspection line requires accept (boolean)"
      )
    }
  }

  try {
    // Map incoming inspection_lines to the workflow's expected ReturnLineItem shape
    const workflowItems = body.inspection_lines.map((line: any) => ({
      line_item_id: line.item_id,
      quantity_returned: line.quantity_returned ?? 1,
      condition: line.condition as ItemCondition,
      accepted: line.accept,
    }))

    // Derive overall inspection_result from line accepts
    const allAccepted = workflowItems.every((i: any) => i.accepted)
    const noneAccepted = workflowItems.every((i: any) => !i.accepted)
    const inspectionResult: "approved" | "rejected" | "partial" = allAccepted
      ? "approved"
      : noneAccepted
      ? "rejected"
      : "partial"

    const { result, errors } = await InspectReturnWorkflow(req.scope).run({
      input: {
        return_id: body.return_id,
        order_id: body.order_id,
        inspector_id: actorId,
        inspection_result: inspectionResult,
        items: workflowItems,
      },
    })

    if (errors && errors.length > 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        errors[0].error?.message || "Inspect-return workflow failed"
      )
    }

    return res.status(201).json({ inspection: result })
  } catch (err: any) {
    if (err instanceof MedusaError) throw err
    console.error("[admin:warehouse:returns] POST failed:", err?.message)
    return res.status(400).json({ error: err?.message || "Failed to submit inspection" })
  }
}
