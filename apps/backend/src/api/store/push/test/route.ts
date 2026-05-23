import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendPushToCustomerTopic } from "../../../../lib/firebase-messaging"

/**
 * POST /store/push/test
 *
 * ⚠️ TEMPORARY DEBUG ENDPOINT — REMOVE BEFORE GENERAL AVAILABILITY ⚠️
 *
 * Sends a one-shot FCM test push to the currently signed-in customer's own
 * topic. Used by the [DEBUG] Send test push button on the storefront profile
 * page to verify end-to-end push delivery from a real device, without needing
 * SSH access or the medusa exec CLI flow.
 *
 * Gated by `PUSH_TEST_ENABLED=true` env var on the backend. Default-off so
 * shipping this route is harmless; we flip the env var on Railway for the
 * QA window, test on devices, then flip it back off (or delete the route).
 *
 * TODO(remove): delete this directory + the matching PushTestButton in
 *   apps/storefront/src/routes/account/_layout/profile.tsx
 * once push notification delivery has been QA'd in production.
 *
 * Mirrors the customer-topic send path in `scripts/test-push.ts`, but
 * triggered by an authenticated customer over HTTP rather than the CLI.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  // Default-off — operator must explicitly enable on the backend env to use this.
  if (process.env.PUSH_TEST_ENABLED !== "true") {
    // 404 (not 403) so the route is invisible when disabled — no enumeration.
    return res.status(404).json({ error: "Not found" })
  }

  const customerId = (req as any).auth_context?.actor_id as string | undefined
  if (!customerId) {
    return res.status(401).json({ error: "Unauthorized customer session" })
  }

  const result = await sendPushToCustomerTopic(customerId, {
    title: "Suprameds push test",
    body: `Notification delivered at ${new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })} IST. If you see this, FCM is working end-to-end.`,
    data: { url: "/account", source: "push-test-button" },
  })

  if (!result.ok) {
    if (result.reason === "missing_env") {
      return res.status(503).json({
        error: "Push notifications are not configured on the server",
        hint: "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY on the backend Railway service.",
      })
    }
    return res.status(502).json({
      error: `Push send failed: ${result.reason}`,
    })
  }

  return res.json({ ok: true, messageId: result.id })
}
