import { model } from "@medusajs/framework/utils"

/**
 * DpdpConsent — DPDP Act consent tracking.
 */
const DpdpConsent = model.define("dpdp_consent", {
  id: model.id().primaryKey(),
  customer_id: model.text().nullable(),
  session_id: model.text().nullable(),
  category: model.enum(["essential", "functional", "analytics", "marketing"]),
  consented: model.boolean().default(false),
  consent_given_at: model.dateTime(),
  withdrawn_at: model.dateTime().nullable(),
  ip_address: model.text(),
  user_agent: model.text(),
  privacy_policy_version: model.text(),
})

export default DpdpConsent
