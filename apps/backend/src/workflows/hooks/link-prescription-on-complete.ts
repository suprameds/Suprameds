import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../modules/prescription"

/**
 * After an order is created from a cart, link the attached prescription.
 *
 * The hook receives { order_id, cart_id } — NOT full objects.
 * We must resolve the cart from the container to read cart.metadata.prescription_id.
 */
// @ts-ignore — orderCreated hook exists at runtime but missing from TS declarations
;(completeCartWorkflow.hooks as any).orderCreated(
  async (data: any, { container }: any) => {
    const orderId = data?.order_id
    const cartId = data?.cart_id
    if (!orderId || !cartId) {
      console.info(`[hook:link-rx] Missing order_id or cart_id: ${JSON.stringify(data)}`)
      return
    }

    // Resolve cart to read metadata.prescription_id
    let prescriptionId: string | undefined
    try {
      const cartService = container.resolve(Modules.CART) as any
      const cart = await cartService.retrieveCart(cartId)
      prescriptionId = (cart?.metadata as any)?.prescription_id
    } catch (err: any) {
      console.warn(`[hook:link-rx] Failed to retrieve cart ${cartId}: ${err.message}`)
      return
    }

    if (!prescriptionId) {
      console.info(`[hook:link-rx] No prescription_id on cart ${cartId} — OTC order`)
      return
    }

    try {
      const prescriptionService = container.resolve(PRESCRIPTION_MODULE) as any
      const [rx] = await prescriptionService.listPrescriptions(
        { id: prescriptionId },
        { take: 1 }
      )

      if (!rx) {
        console.warn(`[hook:link-rx] Prescription ${prescriptionId} not found`)
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
