import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { PHARMA_MODULE } from "../../modules/pharma"
import { PRESCRIPTION_MODULE } from "../../modules/prescription"

/**
 * Compliance hook: validates Rx drugs in the cart have a prescription attached.
 *
 * Flow: customer uploads prescription → places order → pharmacist reviews
 * the prescription post-order and either fulfils, modifies, or cancels.
 *
 * At checkout we only enforce:
 * 1. Schedule X drugs → ABSOLUTE PROHIBITION (NDPS Act, 1985)
 * 2. Schedule H/H1 drugs → must have a prescription attached (approved OR pending_review)
 * 3. Rejected / expired prescriptions are blocked — customer must re-upload
 *
 * The pharmacist verifies the prescription validity AFTER the order is placed,
 * before fulfilment (enforced via admin workflow, not here).
 */
completeCartWorkflow.hooks.validate(
  async ({ cart }, { container }) => {
    if (!cart.items || cart.items.length === 0) return

    const pharmaService = container.resolve(PHARMA_MODULE) as any
    const prescriptionService = container.resolve(PRESCRIPTION_MODULE) as any

    let cartHasRxItem = false

    for (const item of cart.items) {
      if (!item.product_id) continue

      let drugProducts: any[]
      try {
        drugProducts = await pharmaService.listDrugProducts({
          product_id: item.product_id,
        })
      } catch {
        continue
      }

      if (!drugProducts || drugProducts.length === 0) continue
      const drug = drugProducts[0]

      // HARD RULE: Schedule X — absolute prohibition (NDPS Act)
      if (drug.schedule === "X" || drug.is_narcotic) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `${item.title || "This product"} cannot be sold online. NDPS Act, 1985 prohibits online sale of Schedule X / narcotic substances.`
        )
      }

      // HARD RULE: Cold chain — not handled by warehouse
      if (drug.requires_refrigeration) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `${item.title || "This product"} requires cold chain storage which is not available through our delivery network.`
        )
      }

      if (drug.schedule === "H" || drug.schedule === "H1") {
        cartHasRxItem = true
      }
    }

    if (!cartHasRxItem) return

    // ── Validate a prescription is attached ──────────────────────────

    const metadata = cart.metadata as Record<string, any> | null
    const prescriptionId = metadata?.prescription_id

    if (!prescriptionId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Your cart contains prescription medicines. Please attach a valid prescription during checkout."
      )
    }

    const [prescription] = await prescriptionService.listPrescriptions({
      id: prescriptionId,
    })

    if (!prescription) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "The attached prescription could not be found. Please re-attach a valid prescription."
      )
    }

    // Allow "approved" and "pending_review" — pharmacist verifies post-order.
    // Block "rejected", "expired", "used" — customer must upload a new one.
    const blockedStatuses = ["rejected", "expired"]
    if (blockedStatuses.includes(prescription.status)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Your prescription has been ${prescription.status}. Please upload a new, valid prescription.`
      )
    }

    if (
      prescription.valid_until &&
      new Date(prescription.valid_until) < new Date()
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Your prescription has expired. Please upload a new, valid prescription."
      )
    }

    // ── Enforce promo code once-per-customer ─────────────────────────
    await enforcePromoOncePerCustomer(cart, container)
  }
)

/**
 * Checks if the customer has already used any of the promo codes on the cart
 * in a previous order. Throws if a code was already used.
 */
async function enforcePromoOncePerCustomer(cart: any, container: any) {
  const promoCodes = (cart.promotions ?? [])
    .map((p: any) => p.code)
    .filter(Boolean)

  if (!promoCodes.length || !cart.customer_id) return

  try {
    const orderService = container.resolve(Modules.ORDER) as any

    // Fetch customer's past orders that have promotions
    const pastOrders = await orderService.listOrders(
      { customer_id: cart.customer_id },
      { take: null, select: ["id"], relations: ["promotions"] }
    )

    // Collect all promo codes the customer has already used
    const usedCodes = new Set<string>()
    for (const order of pastOrders ?? []) {
      for (const promo of order.promotions ?? []) {
        if (promo.code) usedCodes.add(promo.code.toUpperCase())
      }
    }

    // Check if any current cart promo was already used
    for (const code of promoCodes) {
      if (usedCodes.has(code.toUpperCase())) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Promo code "${code}" has already been used on a previous order. Each code can only be used once.`
        )
      }
    }
  } catch (err: any) {
    // Re-throw MedusaErrors (our validation), swallow unexpected errors
    if (err instanceof MedusaError) throw err
    // If order lookup fails, allow checkout to proceed (don't block on a best-effort check)
    console.warn(`[promo-check] Failed to verify promo usage: ${err.message}`)
  }
}
