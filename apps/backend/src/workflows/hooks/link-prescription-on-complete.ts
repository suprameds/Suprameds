import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../modules/prescription"

/**
 * After an order is created from a cart, link the attached prescription
 * to the order. This runs synchronously in the completeCartWorkflow,
 * which is more reliable than the async order-placed subscriber
 * (metadata propagation from cart→order is not guaranteed).
 *
 * Reads prescription_id from cart.metadata (set during checkout prescription step).
 */
// @ts-ignore — orderCreated hook exists at runtime but missing from TS declarations
;(completeCartWorkflow.hooks as any).orderCreated(
  async (data: any, { container }: any) => {
    // Log the data shape for debugging (remove once working)
    const dataKeys = Object.keys(data || {})
    console.info(`[hook:link-rx] orderCreated fired. Data keys: [${dataKeys.join(", ")}]`)

    // Try multiple property names — hook shape may vary between Medusa versions
    const cart = data?.cart || data?.input?.cart || data
    const order = data?.order || data?.created_order || data?.result

    const prescriptionId =
      (cart?.metadata as any)?.prescription_id ||
      (data?.input?.metadata as any)?.prescription_id

    if (!prescriptionId) {
      console.info("[hook:link-rx] No prescription_id in cart metadata — OTC order or not set")
      return
    }

    const orderId = order?.id || (typeof order === "string" ? order : null)
    if (!orderId) {
      console.warn(`[hook:link-rx] Could not resolve order ID. order value: ${JSON.stringify(order)?.slice(0, 200)}`)
      return
    }

    try {
      const prescriptionService = container.resolve(PRESCRIPTION_MODULE) as any
      const [rx] = await prescriptionService.listPrescriptions(
        { id: prescriptionId },
        { take: 1 }
      )

      if (!rx) {
        console.warn(`[hook:link-rx] Prescription ${prescriptionId} not found — skipping link`)
        return
      }

      const linkService = container.resolve(ContainerRegistrationKeys.LINK) as any
      await linkService.create({
        [Modules.ORDER]: { order_id: orderId },
        [PRESCRIPTION_MODULE]: { prescription_id: prescriptionId },
      })

      console.info(`[hook:link-rx] Linked prescription ${prescriptionId} to order ${orderId}`)
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        console.info(`[hook:link-rx] Link already exists for order ${orderId}`)
      } else {
        console.error(`[hook:link-rx] Failed: ${err.message}`)
      }
    }
  }
)
