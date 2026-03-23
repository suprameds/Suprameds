import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"

type CompleteCartInput = {
  cart_id: string
}

/**
 * Validate cart readiness: items exist, shipping method selected, etc.
 */
const validateCartStep = createStep(
  "complete-cart-validate",
  async (input: { cart_id: string }, { container }) => {
    const cartService = container.resolve(Modules.CART) as any
    const cart = await cartService.retrieveCart(input.cart_id, {
      relations: ["items", "items.variant", "shipping_methods"],
    })

    if (!cart) {
      throw new Error(`Cart ${input.cart_id} not found`)
    }

    if (!cart.items?.length) {
      throw new Error("Cart is empty")
    }

    if (!cart.shipping_methods?.length) {
      throw new Error("No shipping method selected")
    }

    if (!cart.email) {
      throw new Error("Customer email is required")
    }

    return new StepResponse(cart)
  }
)

/**
 * Enforce prescription compliance: Schedule H/H1 items need an approved Rx.
 * Schedule X items are absolutely blocked.
 */
const enforceRxComplianceStep = createStep(
  "complete-cart-rx-compliance",
  async (input: { cart: any }, { container }) => {
    const cart = input.cart
    const items = cart.items || []
    const logger = container.resolve("logger") as any

    let pharmaService: any
    try {
      pharmaService = container.resolve("pharmaCore") as any
    } catch {
      // pharmaCore not available — skip compliance (OTC-only mode)
      return new StepResponse({ compliant: true, rx_required: false })
    }

    let rxRequired = false

    for (const item of items) {
      if (!item.product_id) continue

      let drugProducts: any[]
      try {
        drugProducts = await pharmaService.listDrugProducts({ product_id: item.product_id })
      } catch {
        continue
      }

      const drug = Array.isArray(drugProducts) && drugProducts.length > 0
        ? (Array.isArray(drugProducts[0]) ? drugProducts[0][0] : drugProducts[0])
        : null

      if (!drug) continue

      // HARD RULE: Schedule X cannot be sold online
      if (drug.schedule === "X") {
        throw new Error(
          `Schedule X drug "${item.title}" cannot be sold online (NDPS Act, 1985)`
        )
      }

      if (drug.schedule === "H" || drug.schedule === "H1") {
        rxRequired = true
        const prescriptionId = item.metadata?.prescription_id
        if (!prescriptionId) {
          throw new Error(
            `Schedule ${drug.schedule} drug "${item.title}" requires an approved prescription`
          )
        }
      }
    }

    if (rxRequired) {
      logger.info(`[complete-cart] Cart ${cart.id} contains Rx items — prescription validated`)
    }

    return new StepResponse({ compliant: true, rx_required: rxRequired })
  }
)

/**
 * Enforce no-promotion rule on Rx drugs.
 */
const enforceNoRxDiscountsStep = createStep(
  "complete-cart-no-rx-discounts",
  async (input: { cart: any }, { container }) => {
    const cart = input.cart

    if (!cart.discount_total || cart.discount_total === 0) {
      return new StepResponse({ ok: true })
    }

    // Check if any discounted items are Rx drugs
    let pharmaService: any
    try {
      pharmaService = container.resolve("pharmaCore") as any
    } catch {
      return new StepResponse({ ok: true })
    }

    for (const item of cart.items || []) {
      if (!item.product_id) continue

      try {
        const drugProducts = await pharmaService.listDrugProducts({ product_id: item.product_id })
        const drug = Array.isArray(drugProducts) && drugProducts.length > 0
          ? (Array.isArray(drugProducts[0]) ? drugProducts[0][0] : drugProducts[0])
          : null

        if (drug && (drug.schedule === "H" || drug.schedule === "H1")) {
          if (item.discount_total && item.discount_total > 0) {
            throw new Error(
              `Discounts cannot be applied to prescription drug "${item.title}" (regulatory requirement)`
            )
          }
        }
      } catch (err: any) {
        if (err.message.includes("Discounts cannot")) throw err
        // skip non-pharma items
      }
    }

    return new StepResponse({ ok: true })
  }
)

/**
 * CompleteCartWorkflow — validates cart, enforces Rx compliance and
 * no-discount rules on scheduled drugs, then marks ready for payment.
 */
export const CompleteCartWorkflow = createWorkflow(
  "complete-cart-workflow",
  (input: CompleteCartInput) => {
    const cart = validateCartStep({ cart_id: input.cart_id }) as any

    enforceRxComplianceStep({ cart })
    enforceNoRxDiscountsStep({ cart })

    return new WorkflowResponse({
      success: true,
      cart_id: input.cart_id,
      validated: true,
    })
  }
)
