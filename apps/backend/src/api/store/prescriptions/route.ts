import { 
  AuthenticatedMedusaRequest, 
  MedusaRequest, 
  MedusaResponse 
} from "@medusajs/framework/http"
import { PRESCRIPTION_MODULE } from "../../../modules/prescription"
import { UploadRxWorkflow } from "../../../workflows/prescription/upload-rx"

/**
 * GET /store/prescriptions
 *
 * Returns the authenticated customer's prescriptions.
 * Accepts optional ?status= filter (e.g. "approved", "pending_review").
 * Sorted newest-first.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = (req as any).auth_context?.actor_id

  if (!customerId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any

  const filters: Record<string, any> = { customer_id: customerId }
  const statusParam = req.query.status as string | undefined
  if (statusParam) {
    filters.status = statusParam
  }

  const prescriptions = await prescriptionService.listPrescriptions(
    filters,
    {
      order: { created_at: "DESC" },
      take: 50,
      relations: ["lines"],
    }
  )

  return res.json({ prescriptions, count: prescriptions.length })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { 
    file_key, 
    file_url, 
    original_filename, 
    mime_type, 
    file_size_bytes, 
    guest_phone 
  } = req.body as any
  
  if (!file_key) {
    res.status(400).json({ error: "file_key is required" })
    return
  }

  // Get customer from auth context (Medusa v2 pattern)
  const customer_id = (req as any).auth_context?.actor_id

  if (!customer_id && !guest_phone) {
    res.status(400).json({ error: "Either customer authentication or guest_phone is required" })
    return
  }

  const { result, errors } = await UploadRxWorkflow(req.scope).run({
    input: {
      customer_id,
      guest_phone,
      file_key,
      file_url,
      original_filename,
      mime_type,
      file_size_bytes
    } as any
  })

  if (errors && errors.length > 0) {
    res.status(400).json({ error: errors[0].error?.message || "Internal server error" })
    return
  }

  res.status(201).json({ prescription: result })
}
