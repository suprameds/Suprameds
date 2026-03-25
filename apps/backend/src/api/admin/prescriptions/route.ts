import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  decryptPhiArray,
  PRESCRIPTION_PHI_FIELDS,
  isPhiEncryptionEnabled,
} from "../../../lib/phi-crypto"

const RX_FIELDS = [
  "id",
  "customer_id",
  "guest_phone",
  "status",
  "file_url",
  "original_filename",
  "mime_type",
  "file_size_bytes",
  "doctor_name",
  "doctor_reg_no",
  "patient_name",
  "prescribed_on",
  "valid_until",
  "reviewed_by",
  "reviewed_at",
  "rejection_reason",
  "pharmacist_notes",
  "fully_dispensed",
  "created_at",
  "lines.*",
]

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
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const status = req.query.status as string | undefined
  const orderId = req.query.order_id as string | undefined
  const customerId = req.query.customer_id as string | undefined

  // If filtering by order_id, traverse the order<->prescription link
  if (orderId) {
    try {
      const { data: orderRows } = await query.graph({
        entity: "order",
        fields: ["id", "prescription.*", "prescription.lines.*"],
        filters: { id: orderId },
      })

      let prescriptions = (orderRows as any[])?.[0]?.prescription ?? []

      // Apply status filter on top if provided
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
      // Link may not resolve — fall back to returning empty
      console.warn(
        `[admin:prescriptions] Could not resolve prescriptions for order ${orderId}: ${err?.message}`
      )
      return res.json({ prescriptions: [], count: 0 })
    }
  }

  // Standard listing with optional filters
  const filters: Record<string, any> = {}
  if (status) filters.status = status
  if (customerId) filters.customer_id = customerId

  const { data: prescriptions } = await query.graph({
    entity: "prescription",
    fields: RX_FIELDS,
    filters,
  })

  const result = isPhiEncryptionEnabled()
    ? decryptPhiArray(prescriptions as any[], PRESCRIPTION_PHI_FIELDS)
    : prescriptions

  return res.json({ prescriptions: result, count: result.length })
}
