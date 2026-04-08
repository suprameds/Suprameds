import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { NOTIFICATION_MODULE } from "../../../modules/notification"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required" })
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100)
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0)

  const notificationService = req.scope.resolve(NOTIFICATION_MODULE) as any

  const [notifications, count] = await notificationService.listAndCountInternalNotifications(
    { user_id: customerId },
    {
      order: { created_at: "DESC" },
      skip: offset,
      take: limit,
    }
  )

  res.json({
    notifications: notifications.map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      reference_type: n.reference_type,
      reference_id: n.reference_id,
      read: n.read,
      read_at: n.read_at,
      created_at: n.created_at,
    })),
    count,
    limit,
    offset,
  })
}
