import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, PaymentActions } from "@medusajs/framework/utils"

/**
 * Provider identifier used by the payment module to resolve the Razorpay provider.
 * Constructed as `pp_${PROVIDER}` internally by Medusa.
 */
const PROVIDER = "razorpay_razorpay"
const LOG = "[webhook:razorpay]"

/**
 * Razorpay Webhook Handler
 *
 * Handles: payment.captured, payment.authorized, payment.failed,
 *          refund.processed, order.paid
 *
 * Raw body is preserved via `bodyParser: { preserveRawBody: true }` in
 * middlewares.ts — required for Razorpay HMAC signature verification.
 *
 * Always returns 200 to Razorpay (non-2xx triggers automatic retries).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  logger.info(`${LOG} Webhook received`)

  try {
    const rawBody: Buffer | undefined = (req as any).rawBody
    if (!rawBody) {
      logger.error(
        `${LOG} Raw body unavailable — bodyParser.preserveRawBody may not be configured`
      )
      return res.status(200).json({ received: true })
    }

    const body = req.body as Record<string, unknown>
    const event = body?.event as string | undefined
    const paymentEntity = (body?.payload as any)?.payment?.entity
    logger.info(
      `${LOG} Event: ${event ?? "unknown"}, ` +
        `razorpay_payment_id: ${paymentEntity?.id ?? "n/a"}, ` +
        `razorpay_order_id: ${paymentEntity?.order_id ?? "n/a"}`
    )

    // Delegate to payment module — the provider handles HMAC signature
    // verification via Razorpay.validateWebhookSignature internally.
    const paymentModule = req.scope.resolve(Modules.PAYMENT) as any
    const result = await paymentModule.getWebhookActionAndData({
      provider: PROVIDER,
      payload: {
        data: body,
        rawData: rawBody,
        headers: req.headers,
      },
    })

    logger.info(
      `${LOG} Resolved action: ${result.action}, ` +
        `session_id: ${result.data?.session_id ?? "n/a"}`
    )

    // Only AUTHORIZED and SUCCESSFUL (captured) are processable —
    // mirrors logic in Medusa's built-in payment-webhook subscriber.
    const processableActions: string[] = [
      PaymentActions.AUTHORIZED,
      PaymentActions.SUCCESSFUL,
    ]

    if (!result.data || !processableActions.includes(result.action)) {
      logger.info(`${LOG} Action "${result.action}" — no workflow processing needed`)
      return res.status(200).json({ received: true })
    }

    // Run Medusa's processPaymentWorkflow which handles cart completion,
    // payment authorization, and capture in a single transactional flow.
    const workflowEngine = req.scope.resolve(Modules.WORKFLOW_ENGINE) as any
    await workflowEngine.run("process-payment-workflow", { input: result })

    logger.info(
      `${LOG} Successfully processed "${result.action}" ` +
        `for session ${result.data.session_id}`
    )
  } catch (error) {
    const err = error as Error
    logger.error(`${LOG} Processing error: ${err.message}`, {
      stack: err.stack,
    })
  }

  // Always 200 — Razorpay retries on non-2xx responses
  return res.status(200).json({ received: true })
}
