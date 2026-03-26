import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../../modules/prescription"
import {
  decryptPhiArray,
  PRESCRIPTION_PHI_FIELDS,
  isPhiEncryptionEnabled,
} from "../../../lib/phi-crypto"

/**
 * GET /admin/prescriptions
 * Admin: list prescriptions with optional filtering.
 *
 * Query params:
 *   - status: filter by prescription status
 *   - order_id: filter to prescriptions linked to a specific order
 *   - customer_id: filter by customer
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const status = req.query.status as string | undefined
  const orderId = req.query.order_id as string | undefined
  const customerId = req.query.customer_id as string | undefined

  // If filtering by order_id, traverse the order<->prescription link via query.graph
  if (orderId) {
    try {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data: orderRows } = await query.graph({
        entity: "order",
        fields: ["id", "prescription.*", "prescription.lines.*"],
        filters: { id: orderId },
      })

      let prescriptions = (orderRows as any[])?.[0]?.prescription ?? []

      if (status) {
        prescriptions = prescriptions.filter(
          (rx: any) => rx.status === status
        )
      }

      const result = isPhiEncryptionEnabled()
        ? decryptPhiArray(prescriptions, PRESCRIPTION_PHI_FIELDS)
        : prescriptions

      return res.json({ prescriptions: result, count: result.length })
    } catch (err: any) {
      console.warn(
        `[admin:prescriptions] Could not resolve prescriptions for order ${orderId}: ${err?.message}`
      )
      return res.json({ prescriptions: [], count: 0 })
    }
  }

  // Standard listing — use the module service directly (more reliable than query.graph)
  try {
    const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any

    const filters: Record<string, any> = {}
    if (status) filters.status = status
    if (customerId) filters.customer_id = customerId

    const prescriptions = await prescriptionService.listPrescriptions(
      filters,
      {
        order: { created_at: "DESC" },
        take: 100,
        relations: ["lines"],
      }
    )

    const result = isPhiEncryptionEnabled()
      ? decryptPhiArray(prescriptions, PRESCRIPTION_PHI_FIELDS)
      : prescriptions

    return res.json({ prescriptions: result, count: result.length })
  } catch (err: any) {
    console.error("[admin:prescriptions] Failed to list prescriptions:", err?.message)
    return res.status(500).json({ error: "Failed to load prescriptions" })
  }
}
