import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * POST /store/prescriptions/upload-file
 *
 * Receives a prescription file as base64 and uploads it to S3/R2
 * via Medusa's file module. Returns the file ID and URL for use
 * when creating a prescription record.
 *
 * Body: { filename, content_type, content (base64 WITHOUT data: prefix) }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const { filename, content_type, content } = req.body as {
    filename: string
    content_type: string
    content: string
  }

  if (!filename || !content) {
    return res.status(400).json({ error: "filename and content are required" })
  }

  const fileModuleService = req.scope.resolve(Modules.FILE) as any

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  const key = `rx/${customerId}/${Date.now()}-${safeFilename}`

  const file = await fileModuleService.createFiles({
    filename: key,
    mimeType: content_type || "application/octet-stream",
    content,
    access: "private",
  })

  return res.json({
    file_key: file.id,
    file_url: file.url,
  })
}
