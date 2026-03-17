import { 
  AuthenticatedMedusaRequest, 
  MedusaRequest, 
  MedusaResponse 
} from "@medusajs/framework/http"
import { UploadRxWorkflow } from "../../../workflows/prescription/upload-rx"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json({ message: "store/prescriptions GET stub" })
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
