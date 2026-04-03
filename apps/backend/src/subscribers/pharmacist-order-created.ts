import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { INotificationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:pharmacist-order-created")

interface PharmacistOrderCreatedData {
  order_id: string
  prescription_id: string
  customer_id: string
  pharmacist_id: string
}

/**
 * Fires when a pharmacist creates an order on behalf of a customer.
 * Sends email + push notification to the customer.
 */
export default async function pharmacistOrderCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<PharmacistOrderCreatedData>) {
  const notificationModuleService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION
  )
  const orderService = container.resolve(Modules.ORDER) as any
  const customerService = container.resolve(Modules.CUSTOMER) as any

  let order: any
  try {
    order = await orderService.retrieveOrder(data.order_id, {
      relations: ["items", "shipping_address"],
    })
  } catch (err) {
    logger.error(`Failed to retrieve order ${data.order_id}: ${(err as Error).message}`)
    return
  }

  let customer: any
  try {
    customer = await customerService.retrieveCustomer(data.customer_id)
  } catch (err) {
    logger.error(`Failed to retrieve customer ${data.customer_id}: ${(err as Error).message}`)
    return
  }

  // Build email data
  const items = (order.items ?? []).map((item: any) => ({
    title: item.title || item.product_title || "Medicine",
    quantity: item.quantity ?? 1,
    unit_price: item.unit_price ?? 0,
  }))

  const total = order.total ?? items.reduce(
    (sum: number, i: any) => sum + i.unit_price * i.quantity,
    0
  )

  const shippingAddr = order.shipping_address ?? {}
  const storefrontUrl = process.env.STOREFRONT_URL || "https://suprameds.in"

  // Send email
  if (customer?.email) {
    try {
      await notificationModuleService.createNotifications({
        to: customer.email,
        channel: "email",
        template: "pharmacist-order-created",
        data: {
          display_id: order.display_id ?? order.id,
          prescription_id: data.prescription_id,
          items,
          total,
          shipping_address: {
            first_name: shippingAddr.first_name || "",
            last_name: shippingAddr.last_name || "",
            address_1: shippingAddr.address_1 || "",
            city: shippingAddr.city || "",
            province: shippingAddr.province || "",
            postal_code: shippingAddr.postal_code || "",
            phone: shippingAddr.phone || "",
          },
          shop_url: `${storefrontUrl}/in/account/orders`,
        },
      })
      logger.info(`Email sent to ${customer.email} for order ${data.order_id}`)
    } catch (err) {
      logger.warn(`Email failed for order ${data.order_id}: ${(err as Error).message}`)
      captureException(err, {
        subscriber: "pharmacist-order-created",
        orderId: data.order_id,
        step: "send-email",
      })
    }
  }

  // Send push notification
  if (data.customer_id) {
    const result = await sendPushToCustomerTopic(data.customer_id, {
      title: "Order Created by Pharmacist",
      body: `Your pharmacist has prepared order #${order.display_id ?? ""} from your prescription. Payment: Cash on Delivery.`,
      data: {
        type: "pharmacist_order_created",
        order_id: data.order_id,
        url: "/in/account/orders",
      },
    })

    if (!result.ok) {
      logger.warn(
        `Push notification skipped for order ${data.order_id}: ${result.reason}`
      )
    }
  }

  logger.info(`pharmacist-order.created handled for order ${data.order_id}`)
}

export const config: SubscriberConfig = {
  event: "pharmacist-order.created",
}
