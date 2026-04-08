import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { NOTIFICATION_MODULE } from "../../../../../modules/notification"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  const notificationId = req.params.id
  const notificationService = req.scope.resolve(NOTIFICATION_MODULE) as any

  // Verify the notification exists and belongs to this customer
  const [existing] = await notificationService.listInternalNotifications({
    id: notificationId,
    user_id: customerId,
  })

  if (!existing) {
    return res.status(404).json({ message: "Notification not found" })
  }

  if (existing.read) {
    return res.json({ success: true })
  }

  await notificationService.updateInternalNotifications({
    id: notificationId,
    read: true,
    read_at: new Date(),
  })

  res.json({ success: true })
}
