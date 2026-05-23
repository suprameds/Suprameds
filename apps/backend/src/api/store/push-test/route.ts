import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendPushToCustomerTopic } from "../../../../lib/firebase-messaging"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  if (process.env.PUSH_TEST_ENABLED !== "true") {
    return res.status(404).json({ error: "Not found" })
  }
  const customerId = (req as any).auth_context?.actor_id as string | undefined
  if (!customerId) {
    return res.status(401).json({ error: "Unauthorized customer session" })
  }
  const result = await sendPushToCustomerTopic(customerId, {
    title: "Suprameds push test",
    body: "Push test delivered. If you see this, FCM is working.",
    data: { url: "/account", source: "push-test-button" },
  })
  if (!result.ok) {
    if (result.reason === "missing_env") {
      return res.status(503).json({ error: "Push notifications are not configured on the server" })
    }
    return res.status(502).json({ error: "Push send failed: " + result.reason })
  }
  return res.json({ ok: true, messageId: result.id })
}
