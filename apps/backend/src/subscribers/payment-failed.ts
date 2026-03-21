import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"

const LOG = "[subscriber:payment-failed]"

type PaymentFailedData = {
  id?: string
  payment_session_id?: string
  cart_id?: string
}

export default async function handler({
  event: { data },
  container,
}: SubscriberArgs<PaymentFailedData>) {
  const paymentId = data?.id || data?.payment_session_id
  if (!paymentId) {
    console.warn(`${LOG} Missing payment id in event payload`)
    return
  }

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    // Resolve the customer through payment → payment_collection → cart → customer
    // or payment → payment_collection → order → customer
    let customerId: string | undefined
    let displayRef: string = paymentId

    // Try to find via order link first
    try {
      const { data: paymentRows } = await query.graph({
        entity: "payment",
        fields: [
          "id",
          "payment_collection.id",
        ],
        filters: { id: paymentId },
      })

      const collectionId = (paymentRows as any)?.[0]?.payment_collection?.id
      if (collectionId) {
        // Try to find the order associated with this payment collection
        const { data: orderRows } = await query.graph({
          entity: "order",
          fields: ["id", "display_id", "customer_id"],
          filters: { payment_collection_id: collectionId } as any,
        })
        const order = (orderRows as any)?.[0]
        if (order?.customer_id) {
          customerId = order.customer_id
          displayRef = `#${order.display_id ?? order.id}`
        }
      }
    } catch {
      // Graph query may fail if relations don't exist yet
    }

    if (!customerId) {
      console.info(`${LOG} Could not resolve customer for payment ${paymentId}, skipping push`)
      return
    }

    const result = await sendPushToCustomerTopic(customerId, {
      title: "Payment Failed",
      body: `Payment for order ${displayRef} could not be processed. Please try again or use a different payment method.`,
      data: {
        type: "payment_failed",
        payment_id: paymentId,
        url: `/in/cart`,
      },
    })

    if (result.ok) {
      console.info(`${LOG} Push sent for payment ${paymentId}`)
    } else {
      console.warn(`${LOG} Push skipped for payment ${paymentId} (${result.reason})`)
    }
  } catch (err) {
    console.error(`${LOG} Failed for payment ${paymentId}: ${(err as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "payment.payment_failed" }
