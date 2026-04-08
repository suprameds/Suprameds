import { model } from "@medusajs/framework/utils"

/**
 * SignupRequest — tracks admin self-registration requests for gated roles.
 * When a user signs up requesting a sensitive role (pharmacist, super_admin, etc.),
 * a request is created here pending admin review.
 */
const SignupRequest = model.define("signup_request", {
  id: model.id().primaryKey(),
  email: model.text().searchable(),
  first_name: model.text(),
  last_name: model.text(),
  requested_role_code: model.text(),
  status: model.enum(["pending", "approved", "rejected"]).default("pending"),
  user_id: model.text().nullable(),
  reviewed_by: model.text().nullable(),
  reviewed_at: model.dateTime().nullable(),
  rejection_reason: model.text().nullable(),
})

export default SignupRequest
