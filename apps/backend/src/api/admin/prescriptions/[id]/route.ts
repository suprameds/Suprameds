import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../../../modules/prescription"
import { ReviewRxWorkflow } from "../../../../workflows/prescription/review-rx"
import { decryptPhiFields, encryptPhi, PRESCRIPTION_PHI_FIELDS, isPhiEncryptionEnabled } from "../../../../lib/phi-crypto"

/**
 * GET /admin/prescriptions/:id
 * Admin: retrieve single prescription detail.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any

  const prescriptions = await prescriptionService.listPrescriptions(
    { id },
    { relations: ["lines"], take: 1 }
  )

  if (!prescriptions.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Prescription ${id} not found`)
  }

  const rx = isPhiEncryptionEnabled()
    ? decryptPhiFields(prescriptions[0] as any, PRESCRIPTION_PHI_FIELDS)
    : prescriptions[0]

  return res.json({ prescription: rx })
}

/**
 * POST /admin/prescriptions/:id
 * Admin: approve or reject a prescription.
 * Body: { action: "approve" | "reject", ... }
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const body = req.body as any
  const pharmacistId = req.auth_context?.actor_id || req.auth_context?.auth_identity_id

  if (!pharmacistId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Pharmacist authentication required.")
  }

  if (body.action === "approve") {
    // Lines are optional — pharmacist just approves the prescription image
  } else if (body.action === "reject") {
    if (!body.rejection_reason) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Rejection reason is required."
      )
    }
  } else {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unknown action "${body.action}". Use "approve" or "reject".`
    )
  }

  // Resolve product_id for each line from variant before passing to workflow
  let resolvedLines = body.lines
  if (body.action === "approve" && body.lines?.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    resolvedLines = await Promise.all(
      body.lines.map(async (line: any) => {
        if (line.product_id) return line
        if (!line.product_variant_id) return line
        try {
          const { data: variants } = await query.graph({
            entity: "variants",
            fields: ["id", "product_id"],
            filters: { id: [line.product_variant_id] },
          })
          const vid = (variants as { id: string; product_id?: string }[])?.[0]
          return { ...line, product_id: vid?.product_id || "" }
        } catch {
          return line
        }
      })
    )
  }

  // Encrypt PHI fields entered by pharmacist before persisting
  const shouldEncrypt = isPhiEncryptionEnabled()
  const { result, errors } = await ReviewRxWorkflow(req.scope).run({
    input: {
      prescription_id: id,
      pharmacist_id: pharmacistId as string,
      action: body.action,
      rejection_reason: body.rejection_reason,
      doctor_name: shouldEncrypt ? encryptPhi(body.doctor_name) : body.doctor_name,
      doctor_reg_no: shouldEncrypt ? encryptPhi(body.doctor_reg_no) : body.doctor_reg_no,
      patient_name: shouldEncrypt ? encryptPhi(body.patient_name) : body.patient_name,
      prescribed_on: body.prescribed_on ? new Date(body.prescribed_on) : undefined,
      valid_until: body.valid_until ? new Date(body.valid_until) : undefined,
      pharmacist_notes: shouldEncrypt ? encryptPhi(body.pharmacist_notes) : body.pharmacist_notes,
      lines: resolvedLines,
    },
  })

  if (errors && errors.length > 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, errors[0].error?.message || "Workflow error")
  }

  return res.json({ result })
}
