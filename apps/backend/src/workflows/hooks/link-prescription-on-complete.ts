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
(completeCartWorkflow.hooks as any).orderCreated(
  async ({ cart, order }, { container }) => {
    const prescriptionId = (cart?.metadata as any)?.prescription_id
    if (!prescriptionId) {
      return
    }

    const orderId = (order as any)?.id
    if (!orderId) {
      console.warn("orderCreated hook: order.id not available")
      return
    }

    try {
      const prescriptionService = container.resolve(PRESCRIPTION_MODULE) as any
      const [rx] = await prescriptionService.listPrescriptions(
        { id: prescriptionId },
        { take: 1 }
      )

      if (!rx) {
        console.warn(
          `orderCreated hook: prescription ${prescriptionId} not found — skipping link`
        )
        return
      }

      const linkService = container.resolve(ContainerRegistrationKeys.LINK) as any
      await linkService.create({
        [Modules.ORDER]: { order_id: orderId },
        [PRESCRIPTION_MODULE]: { prescription_id: prescriptionId },
      })

      console.info(
        `orderCreated hook: linked prescription ${prescriptionId} to order ${orderId}`
      )
    } catch (err: any) {
      // Don't throw — linking failure shouldn't block order creation.
      // The subscriber fallback will retry.
      if (err.message?.includes("already exists")) {
        console.info(`orderCreated hook: link already exists for order ${orderId}`)
      } else {
        console.error(
          `orderCreated hook: failed to link prescription to order ${orderId}: ${err.message}`
        )
      }
    }
  }
)
