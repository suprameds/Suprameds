import { model } from "@medusajs/framework/utils"

/**
 * CustomerDocument — ID proof / verification document uploaded by a customer.
 * Supports Aadhaar, PAN, Driving License, Passport, Voter ID.
 * Reviewed by admin staff for KYC compliance.
 */
const CustomerDocument = model.define("customer_document", {
  id: model.id().primaryKey(),
  customer_id: model.text().searchable(),
  document_type: model.enum([
    "aadhaar",
    "pan",
    "driving_license",
    "passport",
    "voter_id",
  ]),
  file_key: model.text(),
  file_url: model.text(),
  original_filename: model.text(),
  status: model.enum(["pending", "approved", "rejected"]).default("pending"),
  reviewed_by: model.text().nullable(),
  reviewed_at: model.dateTime().nullable(),
  rejection_reason: model.text().nullable(),
})

export default CustomerDocument
