import { model } from "@medusajs/framework/utils"
import PrescriptionLine from "./prescription-line"

/**
 * Prescription — tracks customer-uploaded prescription images.
 *
 * Lifecycle:
 *   pending_review → approved (pharmacist approves) → used (linked to order)
 *                 → rejected (pharmacist rejects with reason)
 *   approved → expired (past validity_until date, enforced via scheduled job)
 *
 * Traceability rule: every Rx line item in an order MUST reference
 * a prescription_id that is in `approved` status.
 */
const Prescription = model.define("prescription", {
  id: model.id().primaryKey(),

  // Medusa customer ID (nullable for guest checkout with OTP verification)
  customer_id: model.text().nullable(),

  // Guest session phone (used when customer_id is null, verified via OTP)
  guest_phone: model.text().nullable(),

  // File storage key (S3 presigned upload)
  file_key: model.text(),

  // Public URL for internal pharmacist review (not exposed to customer)
  file_url: model.text().nullable(),

  // Original filename from customer upload
  original_filename: model.text().nullable(),

  // MIME type: image/jpeg | image/png | image/webp | application/pdf
  mime_type: model.text().nullable(),

  // File size in bytes (max 10MB enforced in middleware)
  file_size_bytes: model.number().nullable(),

  // Review status
  status: model
    .enum([
      "pending_review",
      "approved",
      "rejected",
      "expired",
      "used",
    ])
    .default("pending_review"),

  // Pharmacist who reviewed (Medusa user ID)
  reviewed_by: model.text().nullable(),
  reviewed_at: model.dateTime().nullable(),

  // Rejection reason (shown to customer)
  rejection_reason: model.text().nullable(),

  // Doctor name as written on prescription
  doctor_name: model.text().nullable(),

  // Doctor registration number (MCI/state council)
  doctor_reg_no: model.text().nullable(),

  // Patient name as written on prescription
  patient_name: model.text().nullable(),

  // Prescription issue date
  prescribed_on: model.dateTime().nullable(),

  // Prescription validity (default 90 days from issue for most drugs)
  valid_until: model.dateTime().nullable(),

  // Whether this prescription has been fully consumed (all drugs dispensed)
  fully_dispensed: model.boolean().default(false),

  // Notes from pharmacist (internal, not shown to customer)
  pharmacist_notes: model.text().nullable(),

  // Prescription lines (drugs listed on this prescription)
  lines: model.hasMany(() => PrescriptionLine, {
    mappedBy: "prescription",
  }),

  metadata: model.json().nullable(),
})

export default Prescription
