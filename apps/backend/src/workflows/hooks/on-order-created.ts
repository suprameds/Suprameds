import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../modules/prescription"
import { PHARMA_MODULE } from "../../modules/pharma"
import { LOYALTY_MODULE } from "../../modules/loyalty"
import { WALLET_MODULE } from "../../modules/wallet"

/**
 * Single combined hook for completeCartWorkflow.orderCreated.
 * Medusa only allows ONE handler per hook — so all post-order logic goes here.
 *
 * 1. Link prescription to order + auto-create Rx lines
 * 2. Burn loyalty points if redeemed during checkout
 * 3. Debit wallet balance if applied during checkout
 * 4. Tag test-account orders so dispatch / fulfillment paths skip them
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

    // ── Task 3: Debit wallet balance ──
    await debitWalletBalance(container, orderId, cart)

    // ── Task 4: Tag test-account orders ──
    await tagTestAccountOrder(container, orderId, cart)
  }
)

// ─────────────────────────────────────────────────
// Task 1: Prescription linking + auto Rx lines
// ─────────────────────────────────────────────────
async function linkPrescription(container: any, orderId: string, cart: any) {
  let prescriptionId = (cart?.metadata as any)?.prescription_id

  // Fallback: check order metadata if cart metadata doesn't have it
  // (Medusa may propagate cart.metadata → order.metadata on completion)
  if (!prescriptionId) {
    try {
      const orderService = container.resolve(Modules.ORDER) as any
      const order = await orderService.retrieveOrder(orderId)
      prescriptionId = (order?.metadata as any)?.prescription_id
      if (prescriptionId) {
        console.info(`[hook:link-rx] Found prescription_id in order.metadata (not cart.metadata)`)
      }
    } catch {
      // order retrieval failed — continue without fallback
    }
  }

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

// ─────────────────────────────────────────────────
// Task 4: Tag test-account orders (dispatch safeguard)
// ─────────────────────────────────────────────────
/**
 * If the cart's customer is flagged with `metadata.test_account === true`
 * (e.g., the Google Play Store reviewer account), tag the order with
 * `metadata.is_test = true` AND set `metadata.dispatch_blocked_reason` so:
 *   - auto-allocate-fefo skips inventory deduction
 *   - createOrderFulfillmentWorkflow throws instead of booking carrier
 *   - admins see a clear warning in the order detail UI
 *
 * Reviewer COD orders therefore stay in "placed" state forever and never
 * consume real stock or trigger India Post Speed Post booking.
 */
async function tagTestAccountOrder(container: any, orderId: string, cart: any) {
  const customerId = cart?.customer_id
  if (!customerId) return

  try {
    const customerService = container.resolve(Modules.CUSTOMER) as any
    const customer = await customerService.retrieveCustomer(customerId)
    const isTestAccount = (customer?.metadata as any)?.test_account === true
    if (!isTestAccount) return

    const purpose =
      (customer?.metadata as any)?.purpose ?? "test_account"

    const orderService = container.resolve(Modules.ORDER) as any
    const order = await orderService.retrieveOrder(orderId)
    const existingMeta = (order?.metadata ?? {}) as Record<string, any>

    await orderService.updateOrders({
      id: orderId,
      metadata: {
        ...existingMeta,
        is_test: true,
        test_account_purpose: purpose,
        dispatch_blocked_reason:
          "Order placed by a flagged test account (test_account=true). " +
          "Dispatch, FEFO allocation, and carrier booking are skipped.",
      },
    })

    console.warn(
      `[hook:test-tag] Order ${orderId} tagged is_test=true ` +
        `(customer ${customerId}, purpose: ${purpose}) — dispatch skipped`
    )
  } catch (err: any) {
    console.error(
      `[hook:test-tag] Failed to tag test order ${orderId}: ${err?.message}`
    )
    // Non-fatal: order completes either way. Other layers (FEFO + fulfillment
    // hooks) will re-check customer.metadata.test_account as a fallback.
  }
}

// ─────────────────────────────────────────────────
// Task 3: Wallet balance debit
// ─────────────────────────────────────────────────
async function debitWalletBalance(container: any, orderId: string, cart: any) {
  const meta = (cart?.metadata ?? {}) as Record<string, any>
  const walletAmount = Number(meta.wallet_amount ?? 0)
  const walletAccountId = meta.wallet_account_id as string | undefined

  if (!walletAmount || walletAmount <= 0 || !walletAccountId) return

  try {
    const walletService = container.resolve(WALLET_MODULE) as any

    // Verify account still has enough balance
    const [account] = await walletService.listWalletAccounts(
      { id: walletAccountId },
      { take: 1 }
    )

    if (!account) {
      console.warn(`[hook:wallet-debit] Account ${walletAccountId} not found`)
      return
    }

    const actualDebit = Math.min(walletAmount, account.balance)
    if (actualDebit <= 0) return

    // Debit the wallet
    await walletService.debitWallet(
      account.customer_id,
      actualDebit,
      "checkout",
      orderId,
      `Applied ₹${actualDebit} wallet balance on order ${orderId}`
    )

    console.info(
      `[hook:wallet-debit] Debited ₹${actualDebit} from wallet for order ${orderId} ` +
        `(account ${account.id}, new balance: ₹${account.balance - actualDebit})`
    )
  } catch (err: any) {
    console.error(
      `[hook:wallet-debit] Failed to debit wallet for order ${orderId}: ${err.message}`
    )
    // Non-fatal: order should still complete even if wallet debit fails
  }
}
