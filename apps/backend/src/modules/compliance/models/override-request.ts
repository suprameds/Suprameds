import { model } from "@medusajs/framework/utils"

/**
 * OverrideRequest — compliance override with dual-auth approval.
 * Justification must be minimum 50 characters (DB enforced).
 */
const OverrideRequest = model.define("override_request", {
  id: model.id().primaryKey(),
  override_type: model.text(),
  target_entity_type: model.text(),
  target_entity_id: model.text(),
  requested_by: model.text(),
  requested_by_role: model.text(),
  justification: model.text(),
  patient_impact: model.text().nullable(),
  risk_assessment: model.text(),
  supporting_doc_url: model.text().nullable(),
  requires_dual_auth: model.boolean().default(false),
  primary_approver_id: model.text().nullable(),
  primary_approved_at: model.dateTime().nullable(),
  secondary_approver_id: model.text().nullable(),
  secondary_approved_at: model.dateTime().nullable(),
  status: model.enum([
    "pending_primary",
    "pending_secondary",
    "approved",
    "rejected",
    "expired",
    "used",
  ]).default("pending_primary"),
  valid_for_hours: model.number().default(24),
  expires_at: model.dateTime(),
  used_at: model.dateTime().nullable(),
  notified_cdsco: model.boolean().default(false),
  metadata: model.json().nullable(),
})

export default OverrideRequest
