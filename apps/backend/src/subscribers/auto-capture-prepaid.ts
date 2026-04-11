import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:auto-capture-prepaid")

/**
 * Auto-captures prepaid (Razorpay) payments when they are authorized.
 * COD payments (pp_system_default) are skipped — they are captured
 * later when India Post confirms delivery via the COD reconciliation flow.
 */
export default async function autoCaptureHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const paymentId = data.id
  logger.info(`Payment authorized: ${paymentId}`)

  try {
    const paymentModule = container.resolve(Modules.PAYMENT) as any

    // Retrieve the payment to check provider
    const payment = await paymentModule.retrievePayment(paymentId, {
      relations: ["payment_session"],
    })

    const providerId =
      payment?.payment_session?.provider_id || payment?.provider_id || ""

    // Only auto-capture Razorpay (prepaid) — skip COD (system_default)
    if (providerId.includes("razorpay")) {
      logger.info(`Auto-capturing Razorpay payment ${paymentId}`)
      await paymentModule.capturePayment({ payment_id: paymentId })
      logger.info(`Successfully auto-captured payment ${paymentId}`)
    } else {
      logger.info(
        `Skipping auto-capture for non-Razorpay provider: ${providerId}`
      )
    }
  } catch (err) {
    // Non-fatal — don't break the payment flow
    logger.warn(
      `Auto-capture failed for ${paymentId}: ${(err as Error).message}`
    )
  }
}

export const config: SubscriberConfig = {
  event: "payment.authorized",
}
