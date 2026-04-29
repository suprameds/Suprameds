import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { UploadRxWorkflow } from "../../../../../workflows/prescription/upload-rx"
import { createLogger } from "../../../../../lib/logger"

const logger = createLogger("store:pharmacist:prescriptions:upload")

/**
 * POST /store/pharmacist/prescriptions/upload
 *
 * Pharmacist uploads a prescription on behalf of a customer.
 * Unlike the customer-facing POST /store/prescriptions, this endpoint
 * accepts an explicit customer_id in the body (safe because the caller
 * must pass the requirePharmacistRole() guard).
 *
 * Two-step flow matches the customer upload UI:
 *   1. Call POST /store/prescriptions/upload-file  (file → S3/R2)
 *   2. Call this endpoint  (create the prescription record)
 *
 * Body: { customer_id, file_key, file_url, original_filename, mime_type, file_size_bytes }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const {
    customer_id,
    file_key,
    file_url,
    original_filename,
    mime_type,
    file_size_bytes,
  } = req.body as {
    customer_id?: string
    file_key: string
    file_url?: string
    original_filename?: string
    mime_type?: string
    file_size_bytes?: number
  }

  if (!file_key) {
    return res.status(400).json({ error: "file_key is required" })
  }
  if (!customer_id) {
    return res.status(400).json({ error: "customer_id is required" })
  }

  // Verify the customer exists before creating the prescription
  const customerService = req.scope.resolve(Modules.CUSTOMER) as any
  try {
    await customerService.retrieveCustomer(customer_id)
  } catch {
    return res.status(404).json({ error: `Customer ${customer_id} not found` })
  }

  const { result, errors } = await UploadRxWorkflow(req.scope).run({
    input: { customer_id, file_key, file_url, original_filename, mime_type, file_size_bytes },
  })

  if (errors?.length) {
    logger.error(`Pharmacist prescription upload failed: ${errors[0].error?.message}`)
    return res.status(500).json({ error: errors[0].error?.message || "Internal server error" })
  }

  return res.status(201).json({ prescription: result })
}
