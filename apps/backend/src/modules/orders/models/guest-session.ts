import { model } from "@medusajs/framework/utils"

/**
 * GuestSession — allows guest checkout with OTP-verified phone.
 * Cart stored in Redis, session expires after 7 days.
 */
const GuestSession = model.define("guest_session", {
  id: model.id().primaryKey(),
  session_token: model.text().unique(),
  phone: model.text(),
  email: model.text().nullable(),
  cart_id: model.text().nullable(),
  expires_at: model.dateTime(),
  converted_to: model.text().nullable(),
})

export default GuestSession
