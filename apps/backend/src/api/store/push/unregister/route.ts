import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { unsubscribeTokenFromCustomerTopic } from "../../../../lib/firebase-messaging"

type UnregisterPushTokenBody = {
  token?: string
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { token } = (req.body ?? {}) as UnregisterPushTokenBody
  const customerId = (req as any).auth_context?.actor_id as string | undefined

  if (!customerId) {
    return res.status(401).json({ error: "Unauthorized customer session" })
  }

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "token is required" })
  }

  const result = await unsubscribeTokenFromCustomerTopic(customerId, token)

  if (!result.ok && result.reason === "missing_env") {
    return res.status(503).json({ error: "Push notifications are not configured on server" })
  }

  return res.json({ ok: true })
}

