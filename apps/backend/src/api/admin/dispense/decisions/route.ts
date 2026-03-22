import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { PharmacistDecisionWorkflow } from "../../../../workflows/dispense/pharmacist-decision"
import { DISPENSE_MODULE } from "../../../../modules/dispense"

const VALID_DECISIONS = ["approved", "rejected", "substituted", "quantity_modified"] as const

/**
 * GET /admin/dispense/decisions
 * List dispense decisions with optional filters.
 * Query params: order_id, pharmacist_id, decision, prescription_drug_line_id
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const dispenseService = req.scope.resolve(DISPENSE_MODULE) as any

  const filters: Record<string, any> = {}
  const { order_id, pharmacist_id, decision, prescription_drug_line_id } =
    req.query as Record<string, string>

  if (prescription_drug_line_id) {
    filters.prescription_drug_line_id = prescription_drug_line_id
  }
  if (pharmacist_id) {
    filters.pharmacist_id = pharmacist_id
  }
  if (decision) {
    filters.decision = decision
  }

  // order_id filtering requires querying via metadata or joining — filter at service level if supported
  const decisions = await dispenseService.listDispenseDecisions(filters)
  const list = Array.isArray(decisions?.[0]) ? decisions[0] : Array.isArray(decisions) ? decisions : []

  return res.json({ decisions: list })
}

/**
 * POST /admin/dispense/decisions
 * Pharmacist makes a clinical decision on a prescription drug line item.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const body = req.body as any

  // ── Validate required fields ──
  if (!body.prescription_drug_line_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "prescription_drug_line_id is required"
    )
  }
  if (!body.pharmacist_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "pharmacist_id is required"
    )
  }
  if (!body.decision || !VALID_DECISIONS.includes(body.decision)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `decision must be one of: ${VALID_DECISIONS.join(", ")}`
    )
  }

  // Substitution requires an approved_variant_id
  if (body.decision === "substituted" && !body.approved_variant_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "approved_variant_id is required when decision is 'substituted'"
    )
  }

  // Rejection requires a rejection_reason
  if (body.decision === "rejected" && !body.rejection_reason) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "rejection_reason is required when decision is 'rejected'"
    )
  }

  // Override requires an override_reason
  if (body.is_override && !body.override_reason) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "override_reason is required when is_override is true"
    )
  }

  const { result, errors } = await PharmacistDecisionWorkflow(req.scope).run({
    input: {
      prescription_drug_line_id: body.prescription_drug_line_id,
      pharmacist_id: body.pharmacist_id,
      decision: body.decision,
      approved_variant_id: body.approved_variant_id,
      approved_quantity: body.approved_quantity,
      dispensing_notes: body.dispensing_notes,
      rejection_reason: body.rejection_reason,
      is_override: body.is_override,
      override_reason: body.override_reason,
      patient_name: body.patient_name,
      patient_address: body.patient_address,
      patient_age: body.patient_age,
      prescriber_name: body.prescriber_name,
      prescriber_reg_no: body.prescriber_reg_no,
    },
  })

  if (errors && errors.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      errors[0].error?.message || "Pharmacist decision workflow failed"
    )
  }

  return res.status(201).json({ decision: result })
}
