import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { subscribeTokenToCustomerTopic } from "../../../../lib/firebase-messaging"

type RegisterPushTokenBody = {
  token?: string
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { token } = (req.body ?? {}) as RegisterPushTokenBody
  const customerId = (req as any).auth_context?.actor_id as string | undefined

  if (!customerId) {
    return res.status(401).json({ error: "Unauthorized customer session" })
  }

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "token is required" })
  }

  const result = await subscribeTokenToCustomerTopic(customerId, token)

  if (!result.ok) {
    if (result.reason === "missing_env") {
      return res.status(503).json({ error: "Push notifications are not configured on server" })
    }
    return res.status(502).json({ error: "Push notification service temporarily unavailable" })
  }

  return res.json({ ok: true })
}

