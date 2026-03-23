import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

const LOG = "[webhook:stripe]"

/**
 * Stripe Webhook Handler (Backup Gateway)
 * Verifies the webhook signature and processes payment events.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  logger.info(`${LOG} Received event`)

  const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeSecret) {
    logger.warn(`${LOG} STRIPE_WEBHOOK_SECRET not configured — rejecting`)
    return res.status(400).json({ error: "Webhook secret not configured" })
  }

  const signature = req.headers["stripe-signature"] as string
  if (!signature) {
    logger.warn(`${LOG} Missing stripe-signature header`)
    return res.status(400).json({ error: "Missing signature" })
  }

  try {
    // Import Stripe dynamically to avoid crashes when not installed
    let stripe: any
    try {
      const Stripe = (await import("stripe")).default
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
        apiVersion: "2024-06-20" as any,
      })
    } catch {
      logger.warn(`${LOG} Stripe SDK not available`)
      return res.status(200).send("OK")
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body)
    const event = stripe.webhooks.constructEvent(rawBody, signature, stripeSecret)

    logger.info(`${LOG} Event type: ${event.type}, id: ${event.id}`)

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object
        logger.info(
          `${LOG} Payment succeeded: ${paymentIntent.id}, amount: ${paymentIntent.amount}`
        )

        // Emit payment captured event for Medusa's order flow
        try {
          const eventBus = req.scope.resolve(Modules.EVENT_BUS) as any
          const orderId = paymentIntent.metadata?.order_id
          if (orderId) {
            await eventBus.emit({
              name: "order.payment_captured",
              data: {
                id: orderId,
                amount: paymentIntent.amount / 100,
                currency_code: paymentIntent.currency,
              },
            })
          }
        } catch (err) {
          logger.warn(`${LOG} Event emission failed: ${(err as Error).message}`)
        }
        break
      }

      case "payment_intent.payment_failed": {
        const failedIntent = event.data.object
        logger.warn(
          `${LOG} Payment failed: ${failedIntent.id}, error: ${failedIntent.last_payment_error?.message}`
        )
        break
      }

      case "charge.refunded": {
        const charge = event.data.object
        logger.info(`${LOG} Refund processed: ${charge.id}, amount: ${charge.amount_refunded}`)
        break
      }

      default:
        logger.info(`${LOG} Unhandled event type: ${event.type}`)
    }

    res.status(200).json({ received: true })
  } catch (err: any) {
    logger.error(`${LOG} Webhook error: ${err.message}`)
    res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }
}
