import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { decryptPhiArray, PRESCRIPTION_PHI_FIELDS, isPhiEncryptionEnabled } from "../../../lib/phi-crypto"

/**
 * GET /admin/prescriptions
 * Admin: list prescriptions with filtering by status (for pharmacist queue).
 * PHI fields are decrypted before returning.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const status = req.query.status as string | undefined
  const filters: Record<string, any> = {}
  if (status) {
    filters.status = status
  }

  const { data: prescriptions } = await query.graph({
    entity: "prescription",
    fields: [
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
    ],
    filters,
  })

  const result = isPhiEncryptionEnabled()
    ? decryptPhiArray(prescriptions as any[], PRESCRIPTION_PHI_FIELDS)
    : prescriptions

  return res.json({ prescriptions: result, count: result.length })
}
