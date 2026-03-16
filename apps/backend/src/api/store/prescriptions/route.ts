import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createPrescriptionWorkflow } from "../../../workflows/create-prescription"
import { PRESCRIPTION_MODULE } from "../../../modules/prescription"

/**
 * POST /store/prescriptions
 * Create a prescription record with an S3 presigned URL for upload.
 * Customer uploads directly to S3 from the browser, then calls PATCH to confirm.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { original_filename, mime_type, file_size_bytes } = req.validatedBody as any

  const customerId = req.auth_context?.actor_id
  const metadata = req.body as any

  // Validate file type
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
  if (mime_type && !allowedMimes.includes(mime_type)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Unsupported file type. Please upload JPEG, PNG, WebP, or PDF."
    )
  }

  // Validate file size (max 10MB)
  if (file_size_bytes && file_size_bytes > 10 * 1024 * 1024) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "File too large. Maximum size is 10MB."
    )
  }

  // Generate a unique S3 key for this prescription
  const timestamp = Date.now()
  const safeFilename = (original_filename || "prescription").replace(/[^a-zA-Z0-9._-]/g, "_")
  const fileKey = `prescriptions/${customerId || "guest"}/${timestamp}_${safeFilename}`

  // Get file service for presigned URL
  const fileService = req.scope.resolve("file")

  let presignedUrl: string | undefined
  let fileUrl: string | undefined

  try {
    const uploadResult = await fileService.getPresignedUploadUrl({
      fileKey,
      mimeType: mime_type || "application/octet-stream",
    })
    presignedUrl = uploadResult.url
    fileUrl = uploadResult.fileUrl
  } catch {
    // Presigned URLs not supported in dev — fall back to direct upload endpoint
    fileUrl = null
  }

  const { result } = await createPrescriptionWorkflow(req.scope).run({
    input: {
      customer_id: customerId || undefined,
      guest_phone: (metadata?.guest_phone as string) || undefined,
      file_key: fileKey,
      file_url: fileUrl || undefined,
      original_filename,
      mime_type,
      file_size_bytes,
    },
  })

  return res.status(201).json({
    prescription: result.prescription,
    presigned_upload_url: presignedUrl,
    file_key: fileKey,
  })
}

/**
 * GET /store/prescriptions
 * List prescriptions for the authenticated customer.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id

  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Authentication required to view prescriptions."
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: prescriptions } = await query.graph({
    entity: "prescription",
    fields: [
      "id",
      "status",
      "original_filename",
      "mime_type",
      "doctor_name",
      "patient_name",
      "prescribed_on",
      "valid_until",
      "rejection_reason",
      "fully_dispensed",
      "created_at",
      "lines.*",
    ],
    filters: {
      customer_id: customerId,
    },
  })

  return res.json({ prescriptions })
}
