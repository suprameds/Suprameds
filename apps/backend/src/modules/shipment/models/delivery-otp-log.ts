import { model } from "@medusajs/framework/utils"

/**
 * DeliveryOtpLog — OTP delivery logs for Rx orders.
 * OTP mandatory for all orders containing scheduled drugs.
 */
const DeliveryOtpLog = model.define("delivery_otp_log", {
  id: model.id().primaryKey(),

  shipment_id: model.text(),

  // Hashed — never stored plain
  otp_code: model.text(),

  // Masked phone number
  sent_to_phone: model.text(),

  attempts: model.number().default(0),
  verified: model.boolean().default(false),
  verified_at: model.dateTime().nullable(),
  failed_reason: model.text().nullable(),
})

export default DeliveryOtpLog
