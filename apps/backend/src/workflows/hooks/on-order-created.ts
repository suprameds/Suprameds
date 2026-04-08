import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../modules/prescription"
import { PHARMA_MODULE } from "../../modules/pharma"
import { LOYALTY_MODULE } from "../../modules/loyalty"

/**
 * Single combined hook for completeCartWorkflow.orderCreated.
 * Medusa only allows ONE handler per hook — so all post-order logic goes here.
 *
 * 1. Link prescription to order + auto-create Rx lines
 * 2. Burn loyalty points if redeemed during checkout
 */
// @ts-ignore — orderCreated hook exists at runtime but missing from TS declarations
;(completeCartWorkflow.hooks as any).orderCreated(
  async (data: any, { container }: any) => {
    const orderId = data?.order_id
    const cartId = data?.cart_id
    if (!orderId || !cartId) return

    // ── Resolve cart (shared by both tasks) ──
    let cart: any
    try {
      const cartService = container.resolve(Modules.CART) as any
      cart = await cartService.retrieveCart(cartId)
    } catch (err: any) {
      console.warn(`[hook:orderCreated] Failed to retrieve cart ${cartId}: ${err.message}`)
      return
    }

    // ── Task 1: Link prescription to order ──
    await linkPrescription(container, orderId, cart)

    // ── Task 2: Burn loyalty points ──
    await burnLoyaltyPoints(container, orderId, cart)
  }
)

// ─────────────────────────────────────────────────
// Task 1: Prescription linking + auto Rx lines
// ─────────────────────────────────────────────────
async function linkPrescription(container: any, orderId: string, cart: any) {
  const prescriptionId = (cart?.metadata as any)?.prescription_id
  if (!prescriptionId) return

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

    // Link prescription to order
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

    // Auto-create prescription lines for Rx items
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
      } catch { /* if pharma check fails, skip Rx line creation */ }
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

// ─────────────────────────────────────────────────
// Task 2: Loyalty points burn
// ─────────────────────────────────────────────────
async function burnLoyaltyPoints(container: any, orderId: string, cart: any) {
  const meta = (cart?.metadata ?? {}) as Record<string, any>
  const pointsRedeemed = Number(meta.loyalty_points_redeemed ?? 0)
  const accountId = meta.loyalty_account_id as string | undefined

  if (!pointsRedeemed || pointsRedeemed <= 0 || !accountId) return

  try {
    const loyaltyService = container.resolve(LOYALTY_MODULE) as any

    // Verify account still has enough points
    const [account] = await loyaltyService.listLoyaltyAccounts(
      { id: accountId },
      { take: 1 }
    )

    if (!account) {
      console.warn(`[hook:loyalty-burn] Account ${accountId} not found`)
      return
    }

    const actualBurn = Math.min(pointsRedeemed, account.points_balance)
    if (actualBurn <= 0) return

    // Create burn transaction
    await loyaltyService.createLoyaltyTransactions({
      account_id: account.id,
      type: "burn",
      points: -actualBurn,
      reference_type: "order",
      reference_id: orderId,
      reason: `Redeemed ${actualBurn} points on order ${orderId}`,
    })

    // Deduct from balance
    await loyaltyService.updateLoyaltyAccounts({
      id: account.id,
      points_balance: account.points_balance - actualBurn,
    })

    console.info(
      `[hook:loyalty-burn] Burned ${actualBurn} points for order ${orderId} ` +
        `(account ${account.id}, new balance: ${account.points_balance - actualBurn})`
    )

    // Emit event for push notification
    try {
      const eventBus = container.resolve(Modules.EVENT_BUS) as any
      await eventBus.emit({
        name: "loyalty.points_redeemed",
        data: {
          customer_id: account.customer_id,
          points_redeemed: actualBurn,
          order_id: orderId,
        },
      })
    } catch {
      // Best-effort notification
    }
  } catch (err: any) {
    console.error(
      `[hook:loyalty-burn] Failed to burn points for order ${orderId}: ${err.message}`
    )
    // Non-fatal: order should still complete even if loyalty burn fails
  }
}
