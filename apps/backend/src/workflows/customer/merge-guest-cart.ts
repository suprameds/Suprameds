import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../../modules/orders"

type MergeGuestCartInput = {
  customer_id: string
  guest_session_id: string
}

/**
 * Finds the guest session and retrieves its associated cart.
 */
const findGuestSessionStep = createStep(
  "merge-guest-find-session",
  async (input: { guest_session_id: string }, { container }) => {
    const orderService = container.resolve(ORDERS_MODULE) as any

    const session = await orderService.retrieveGuestSession(input.guest_session_id)
    if (!session) {
      throw new Error(`Guest session ${input.guest_session_id} not found`)
    }

    if (!session.cart_id) {
      throw new Error(`Guest session ${input.guest_session_id} has no associated cart`)
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      throw new Error(`Guest session ${input.guest_session_id} has expired`)
    }

    const cartService = container.resolve(Modules.CART) as any
    const guestCart = await cartService.retrieveCart(session.cart_id, {
      relations: ["items", "items.variant", "shipping_address"],
    })

    return new StepResponse({ session, guest_cart: guestCart })
  }
)

/**
 * Finds the customer's active cart, or creates a new one.
 */
const findOrCreateCustomerCartStep = createStep(
  "merge-guest-find-customer-cart",
  async (
    input: { customer_id: string; region_id: string; currency_code: string },
    { container }
  ) => {
    const cartService = container.resolve(Modules.CART) as any

    // Look for an existing active cart for this customer
    const [existingCart] = await cartService.listCarts(
      { customer_id: input.customer_id, completed_at: null },
      { take: 1, relations: ["items", "items.variant", "shipping_address"] }
    )

    if (existingCart) {
      return new StepResponse({ cart: existingCart, created_new: false })
    }

    // Create a new cart inheriting region/currency from guest cart
    const newCart = await cartService.createCarts({
      customer_id: input.customer_id,
      region_id: input.region_id,
      currency_code: input.currency_code,
    })

    const fullCart = await cartService.retrieveCart(newCart.id, {
      relations: ["items", "items.variant", "shipping_address"],
    })

    return new StepResponse({ cart: fullCart, created_new: true })
  }
)

/**
 * Merges line items from the guest cart into the customer's cart.
 * - Same variant → add quantities
 * - Different variant → create new line item
 */
const mergeLineItemsStep = createStep(
  "merge-guest-line-items",
  async (
    input: { customer_cart_id: string; guest_cart_items: any[] },
    { container }
  ) => {
    const cartService = container.resolve(Modules.CART) as any
    const logger = container.resolve("logger") as any

    let addedCount = 0
    let mergedCount = 0

    // Reload customer cart items fresh
    const customerCart = await cartService.retrieveCart(input.customer_cart_id, {
      relations: ["items"],
    })

    const existingItemsByVariant = new Map<string, any>()
    for (const item of customerCart.items ?? []) {
      if (item.variant_id) {
        existingItemsByVariant.set(item.variant_id, item)
      }
    }

    for (const guestItem of input.guest_cart_items ?? []) {
      if (!guestItem.variant_id) continue

      const existingItem = existingItemsByVariant.get(guestItem.variant_id)

      if (existingItem) {
        // Same variant exists — increment quantity
        await cartService.updateLineItems(existingItem.id, {
          quantity: existingItem.quantity + guestItem.quantity,
        })
        mergedCount++
        logger.info(
          `[cart-merge] Merged variant ${guestItem.variant_id}: qty ${existingItem.quantity} + ${guestItem.quantity}`
        )
      } else {
        // New variant — add as new line item
        await cartService.addLineItems(input.customer_cart_id, {
          variant_id: guestItem.variant_id,
          quantity: guestItem.quantity,
        })
        addedCount++
      }
    }

    return new StepResponse({ added: addedCount, merged: mergedCount })
  }
)

/**
 * Copies shipping address from guest cart if the customer's cart has none.
 */
const copyShippingAddressStep = createStep(
  "merge-guest-copy-address",
  async (
    input: {
      customer_cart_id: string
      customer_has_address: boolean
      guest_shipping_address: any
    },
    { container }
  ) => {
    if (input.customer_has_address || !input.guest_shipping_address) {
      return new StepResponse({ copied: false })
    }

    const cartService = container.resolve(Modules.CART) as any
    const addr = input.guest_shipping_address

    await cartService.updateCarts(input.customer_cart_id, {
      shipping_address: {
        first_name: addr.first_name,
        last_name: addr.last_name,
        address_1: addr.address_1,
        address_2: addr.address_2,
        city: addr.city,
        province: addr.province,
        postal_code: addr.postal_code,
        country_code: addr.country_code,
        phone: addr.phone,
      },
    })

    return new StepResponse({ copied: true })
  }
)

/**
 * Deletes the guest session after successful merge.
 */
const deleteGuestSessionStep = createStep(
  "merge-guest-delete-session",
  async (input: { guest_session_id: string }, { container }) => {
    const orderService = container.resolve(ORDERS_MODULE) as any
    await orderService.deleteGuestSessions(input.guest_session_id)
    return new StepResponse({ deleted: true })
  },
  // Compensation: cannot un-delete, but this is a best-effort cleanup
  async () => {}
)

/**
 * Emits cart.merged event for downstream subscribers.
 */
const emitCartMergedStep = createStep(
  "merge-guest-emit-event",
  async (
    input: { customer_id: string; cart_id: string; guest_session_id: string },
    { container }
  ) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    await eventBus.emit({
      name: "cart.merged",
      data: {
        customer_id: input.customer_id,
        cart_id: input.cart_id,
        guest_session_id: input.guest_session_id,
      },
    })
    return new StepResponse(null)
  }
)

/**
 * MergeGuestCartWorkflow — merges a guest session's cart into a logged-in customer's cart.
 * Used when a guest user authenticates/registers during checkout.
 */
export const MergeGuestCartWorkflow = createWorkflow(
  "merge-guest-cart-workflow",
  (input: MergeGuestCartInput) => {
    // Step 1: Find guest session + cart
    const { session, guest_cart } = findGuestSessionStep({
      guest_session_id: input.guest_session_id,
    }) as any

    // Step 2: Find or create customer's cart
    const { cart: customerCart } = findOrCreateCustomerCartStep({
      customer_id: input.customer_id,
      region_id: guest_cart.region_id,
      currency_code: guest_cart.currency_code,
    }) as any

    // Step 3: Merge line items
    const mergeResult = mergeLineItemsStep({
      customer_cart_id: customerCart.id,
      guest_cart_items: guest_cart.items,
    }) as any

    // Step 4: Copy shipping address if customer has none
    copyShippingAddressStep({
      customer_cart_id: customerCart.id,
      customer_has_address: Boolean(customerCart.shipping_address),
      guest_shipping_address: guest_cart.shipping_address,
    })

    // Step 5: Delete guest session
    deleteGuestSessionStep({
      guest_session_id: input.guest_session_id,
    })

    // Step 6: Emit cart.merged event
    emitCartMergedStep({
      customer_id: input.customer_id,
      cart_id: customerCart.id,
      guest_session_id: input.guest_session_id,
    })

    return new WorkflowResponse({
      customer_id: input.customer_id,
      cart_id: customerCart.id,
      items_added: mergeResult.added,
      items_merged: mergeResult.merged,
    })
  }
)
