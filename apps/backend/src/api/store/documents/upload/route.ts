import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { COMPLIANCE_MODULE } from "../../../../modules/compliance"

const VALID_DOCUMENT_TYPES = [
  "aadhaar",
  "pan",
  "driving_license",
  "passport",
  "voter_id",
] as const

/**
 * POST /store/documents/upload
 *
 * Receives a document file as base64 and uploads it to S3/R2
 * via Medusa's file module. Creates a CustomerDocument record
 * in the compliance module.
 *
 * Body: { filename, content_type, content (base64), document_type }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const { filename, content_type, content, document_type } = req.body as {
    filename: string
    content_type: string
    content: string
    document_type: string
  }

  if (!filename || !content || !document_type) {
    return res
      .status(400)
      .json({ error: "filename, content, and document_type are required" })
  }

  if (
    !VALID_DOCUMENT_TYPES.includes(
      document_type as (typeof VALID_DOCUMENT_TYPES)[number]
    )
  ) {
    return res.status(400).json({
      error: `Invalid document_type. Must be one of: ${VALID_DOCUMENT_TYPES.join(", ")}`,
    })
  }

  const fileModuleService = req.scope.resolve(Modules.FILE) as any
  const complianceService = req.scope.resolve(COMPLIANCE_MODULE) as any

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  const key = `idproof/${customerId}/${Date.now()}-${safeFilename}`

  try {
    const file = await fileModuleService.createFiles({
      filename: key,
      mimeType: content_type || "application/octet-stream",
      content,
      access: "private",
    })

    const document = await complianceService.createCustomerDocuments({
      customer_id: customerId,
      document_type,
      file_key: file.id,
      file_url: file.url,
      original_filename: filename,
      status: "pending",
    })

    return res.json({ document })
  } catch (err: any) {
    const logger = req.scope.resolve("logger") as any
    logger.error(`[documents/upload] Upload failed: ${err.message}`)
    return res.status(503).json({
      error:
        "Document upload service is temporarily unavailable. Please try again.",
    })
  }
}
