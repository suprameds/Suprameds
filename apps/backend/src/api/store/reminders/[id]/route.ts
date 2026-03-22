import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { CRM_MODULE } from "../../../../modules/crm"

/**
 * POST /store/reminders/:id
 *
 * Updates a reminder (toggle active, change frequency).
 * Accepts: { is_active?: boolean, frequency_days?: number }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const { id } = req.params
  const { is_active, frequency_days } = req.body as {
    is_active?: boolean
    frequency_days?: number
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any

  // Verify ownership
  const [pattern] = await crmService.listChronicReorderPatterns(
    { id, customer_id: customerId },
    { take: 1 }
  )

  if (!pattern) {
    return res.status(404).json({ error: "Reminder not found" })
  }

  const updates: Record<string, any> = {}

  if (typeof is_active === "boolean") {
    updates.is_active = is_active
  }

  if (frequency_days && frequency_days >= 1 && frequency_days <= 365) {
    updates.average_days_between_orders = frequency_days
    updates.next_expected_at = new Date(
      Date.now() + frequency_days * 24 * 60 * 60 * 1000
    )
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" })
  }

  await crmService.updateChronicReorderPatterns(id, updates)

  return res.json({ reminder: { ...pattern, ...updates } })
}

/**
 * DELETE /store/reminders/:id
 *
 * Deletes a reminder. Only the owning customer can delete.
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const { id } = req.params
  const crmService = req.scope.resolve(CRM_MODULE) as any

  const [pattern] = await crmService.listChronicReorderPatterns(
    { id, customer_id: customerId },
    { take: 1 }
  )

  if (!pattern) {
    return res.status(404).json({ error: "Reminder not found" })
  }

  await crmService.deleteChronicReorderPatterns(id)

  return res.json({ id, deleted: true })
}
