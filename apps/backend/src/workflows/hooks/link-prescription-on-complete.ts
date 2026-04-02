import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../modules/prescription"
import { PHARMA_MODULE } from "../../modules/pharma"

/**
 * After an order is created from a cart:
 * 1. Link the attached prescription to the order
 * 2. Auto-create prescription lines for each Rx item (Schedule H/H1)
 *    so the pharmacist gets approve/reject buttons immediately
 *
 * The hook receives { order_id, cart_id } — NOT full objects.
 */
// @ts-ignore — orderCreated hook exists at runtime but missing from TS declarations
;(completeCartWorkflow.hooks as any).orderCreated(
  async (data: any, { container }: any) => {
    const orderId = data?.order_id
    const cartId = data?.cart_id
    if (!orderId || !cartId) return

    // ── 1. Resolve cart metadata for prescription_id ──
    let prescriptionId: string | undefined
    try {
      const cartService = container.resolve(Modules.CART) as any
      const cart = await cartService.retrieveCart(cartId)
      prescriptionId = (cart?.metadata as any)?.prescription_id
    } catch (err: any) {
      console.warn(`[hook:link-rx] Failed to retrieve cart ${cartId}: ${err.message}`)
      return
    }

    if (!prescriptionId) return

    // ── 2. Link prescription to order ──
    try {
      const prescriptionService = container.resolve(PRESCRIPTION_MODULE) as any
      const [rx] = await prescriptionService.listPrescriptions(
        { id: prescriptionId },
        { take: 1, relations: ["lines"] }
      )

      if (!rx) {
        console.warn(`[hook:link-rx] Prescription ${prescriptionId} not found`)
        return
      }

      const linkService = container.resolve(ContainerRegistrationKeys.LINK) as any
      try {
        await linkService.create({
          [Modules.ORDER]: { order_id: orderId },
          [PRESCRIPTION_MODULE]: { prescription_id: prescriptionId },
        })
        console.info(`[hook:link-rx] Linked prescription ${prescriptionId} to order ${orderId}`)
      } catch (err: any) {
        if (!err.message?.includes("already exists")) {
          console.error(`[hook:link-rx] Link failed: ${err.message}`)
        }
      }

      // ── 3. Auto-create prescription lines for Rx items ──
      const existingLineProductIds = new Set(
        (rx.lines ?? []).map((l: any) => l.product_id)
      )

      const orderService = container.resolve(Modules.ORDER) as any
      const order = await orderService.retrieveOrder(orderId, { relations: ["items"] })
      const items = order?.items ?? []

      if (!items.length) return

      // Find which items are Schedule H/H1
      const pharmaService = container.resolve(PHARMA_MODULE) as any
      const productIds = items.map((i: any) => i.product_id).filter(Boolean)
      let rxProductIds = new Set<string>()

      if (productIds.length) {
        try {
          const drugs = await pharmaService.listDrugProducts({ product_id: productIds })
          for (const d of drugs) {
            if (d.schedule === "H" || d.schedule === "H1") {
              rxProductIds.add(d.product_id)
            }
          }
        } catch { /* if pharma check fails, create lines for all items */ }
      }

      // Create prescription lines for Rx items that don't already have one
      const linesToCreate: any[] = []
      for (const item of items) {
        if (!item.product_id || !item.variant_id) continue
        if (!rxProductIds.has(item.product_id)) continue
        if (existingLineProductIds.has(item.product_id)) continue

        linesToCreate.push({
          prescription_id: prescriptionId,
          product_id: item.product_id,
          product_variant_id: item.variant_id,
          approved_quantity: item.quantity,
          dispensed_quantity: 0,
          metadata: { auto_mapped: true, order_id: orderId },
        })
      }

      if (linesToCreate.length) {
        for (const lineData of linesToCreate) {
          await prescriptionService.createPrescriptionLines(lineData)
        }
        console.info(
          `[hook:link-rx] Auto-created ${linesToCreate.length} prescription lines for order ${orderId}`
        )
      }
    } catch (err: any) {
      console.error(`[hook:link-rx] Failed: ${err.message}`)
    }
  }
)
