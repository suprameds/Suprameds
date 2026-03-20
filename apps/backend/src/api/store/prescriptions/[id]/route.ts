import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { PRESCRIPTION_MODULE } from "../../../../modules/prescription"

/**
 * GET /store/prescriptions/:id
 *
 * Returns a single prescription by ID.
 * Only the owning customer can view it.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params
  const customerId = (req as any).auth_context?.actor_id

  const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any

  const [prescription] = await prescriptionService.listPrescriptions(
    { id },
    { relations: ["lines"] }
  )

  if (!prescription) {
    return res.status(404).json({ error: "Prescription not found" })
  }

  if (customerId && prescription.customer_id !== customerId) {
    return res.status(403).json({ error: "Access denied" })
  }

  return res.json({ prescription })
}
