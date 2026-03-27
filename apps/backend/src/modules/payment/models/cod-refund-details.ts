import { model } from "@medusajs/framework/utils"

/**
 * CodRefundDetails — bank/UPI details for COD refund transfers.
 * Required when processing a refund for a Cash-on-Delivery order.
 * Verified flag is set by finance_admin after manual bank validation.
 */
const CodRefundDetails = model.define("cod_refund_details", {
  id: model.id().primaryKey(),

  // FK → pharma_refund.id
  refund_id: model.text(),

  account_holder_name: model.text(),
  bank_name: model.text(),
  account_number: model.text(),
  ifsc_code: model.text(),

  // Optional UPI handle for UPI-based refund transfer
  upi_id: model.text().nullable(),

  // Set to true by finance_admin after manual validation
  verified: model.boolean().default(false),

  metadata: model.json().nullable(),
})

export default CodRefundDetails
