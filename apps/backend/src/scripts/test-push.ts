/**
 * Send a one-shot FCM test push to a customer's topic.
 *
 * Confirms the backend → Firebase Admin SDK path works without needing
 * to trigger a real order or loyalty event. Useful before launch to
 * verify push delivery end-to-end.
 *
 *   TARGET_CUSTOMER_ID=cus_01... npx medusa exec ./src/scripts/test-push.ts
 *
 * The customer must have at least one device that:
 *   1. Signed in to the storefront
 *   2. Granted notification permission
 *   3. Successfully registered an FCM token via POST /store/push/register
 *      (subscribing the device to the `customer-<id>` topic)
 *
 * Tip: open https://supracyn.in on the target device, sign in, accept the
 * push prompt, then run this script.
 *
 * Optional env vars:
 *   TITLE   — push title (default "FCM test push")
 *   BODY    — push body (default timestamped sanity-check string)
 *   URL     — deep link URL embedded in the click action (default /)
 */

import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"

export default async function testPush({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any

  const customerId = process.env.TARGET_CUSTOMER_ID?.trim()
  if (!customerId) {
    logger.error(
      "TARGET_CUSTOMER_ID env var is required. " +
        "Example: TARGET_CUSTOMER_ID=cus_01... npx medusa exec ./src/scripts/test-push.ts"
    )
    throw new Error("Missing TARGET_CUSTOMER_ID")
  }

  // Sanity check that the customer exists — avoids sending into a void if
  // the operator pasted a bad ID.
  const customerService = container.resolve(Modules.CUSTOMER) as any
  let customer
  try {
    customer = await customerService.retrieveCustomer(customerId)
  } catch {
    logger.error(`Customer ${customerId} not found — check the ID.`)
    throw new Error("Customer not found")
  }

  const who = customer?.email || customer?.phone || customer?.id
  logger.info(`Sending test push to customer-topic for ${who} (${customerId})`)

  const title = process.env.TITLE || "FCM test push"
  const body =
    process.env.BODY ||
    `Sanity check from /scripts/test-push at ${new Date().toLocaleString("en-IN")}`
  const url = process.env.URL || "/"

  const result = await sendPushToCustomerTopic(customerId, {
    title,
    body,
    data: { url, source: "test-push-script" },
  })

  if (result.ok) {
    logger.info(`✓  Push dispatched. Firebase message id: ${result.id}`)
    logger.info(
      "If no notification arrives on the device:\n" +
        "  • Confirm the device has registered an FCM token (open the app/site\n" +
        "    while logged in as the target customer, accept the push prompt).\n" +
        "  • Browser tab must be backgrounded (not focused) to show a system\n" +
        "    notification; foregrounded tabs dispatch via onMessage handler.\n" +
        "  • Native app must NOT be force-closed (Android may suppress)."
    )
  } else {
    logger.error(
      `✗  sendPushToCustomerTopic failed: reason=${result.reason}`
    )
    if (result.reason === "missing_env") {
      logger.error(
        "Backend env vars not set. Required: FIREBASE_PROJECT_ID, " +
          "FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
      )
    }
    throw new Error("Push send failed")
  }
}
