import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  approvePrescriptionWorkflow,
  rejectPrescriptionWorkflow,
} from "../../../../workflows/review-prescription"

/**
 * GET /admin/prescriptions/:id
 * Admin: retrieve single prescription detail.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: prescriptions } = await query.graph({
    entity: "prescription",
    fields: [
      "id",
      "customer_id",
      "guest_phone",
      "status",
      "file_key",
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
    filters: { id },
  })

  if (!prescriptions.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Prescription ${id} not found`)
  }

  return res.json({ prescription: prescriptions[0] })
}

/**
 * POST /admin/prescriptions/:id
 * Admin: approve or reject a prescription.
 * Body: { action: "approve" | "reject", ... }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const body = req.validatedBody as any
  const pharmacistId = req.auth_context?.actor_id

  if (!pharmacistId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Pharmacist authentication required.")
  }

  if (body.action === "approve") {
    if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "At least one prescription line is required for approval."
      )
    }

    const { result } = await approvePrescriptionWorkflow(req.scope).run({
      input: {
        prescription_id: id,
        pharmacist_id: pharmacistId,
        doctor_name: body.doctor_name,
        doctor_reg_no: body.doctor_reg_no,
        patient_name: body.patient_name,
        prescribed_on: body.prescribed_on,
        valid_until: body.valid_until,
        pharmacist_notes: body.pharmacist_notes,
        lines: body.lines,
      },
    })

    return res.json(result)
  }

  if (body.action === "reject") {
    if (!body.rejection_reason) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Rejection reason is required."
      )
    }

    const { result } = await rejectPrescriptionWorkflow(req.scope).run({
      input: {
        prescription_id: id,
        pharmacist_id: pharmacistId,
        rejection_reason: body.rejection_reason,
      },
    })

    return res.json(result)
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Unknown action "${body.action}". Use "approve" or "reject".`
  )
}
