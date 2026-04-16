import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import type { FulfillmentTypes } from "@medusajs/types"
import { createLogger } from "../../lib/logger"

const logger = createLogger("provider:fulfillment-conditional")

/**
 * Custom fulfillment provider for conditional shipping pricing.
 *
 * - Cart item_total >= ₹300 → free shipping (₹0)
 * - Cart item_total <  ₹300 → standard charge (₹50)
 *
 * Medusa stores amounts in whole currency units (₹50 = 50, not 5000).
 *
 * The third arg to calculatePrice is a CartPropsForFulfillment context.
 * It is a flat object with { id, shipping_address, items, cart, ... }
 * — NOT nested under context.cart.
 */

// Keep in sync with apps/storefront/src/lib/utils/shipping.ts
const FREE_SHIPPING_THRESHOLD = 300
const STANDARD_SHIPPING_CHARGE = 50

class ConditionalShippingService extends AbstractFulfillmentProviderService {
  static identifier = "conditional-shipping"

  async getFulfillmentOptions(): Promise<
    FulfillmentTypes.FulfillmentOption[]
  > {
    return [{ id: "conditional-standard" }]
  }

  async canCalculate(): Promise<boolean> {
    return true
  }

  async calculatePrice(
    _optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: any
  ): Promise<FulfillmentTypes.CalculatedShippingOptionPrice> {
    // Medusa v2 passes context as a flat CartPropsForFulfillment:
    //   context.items  — line items with unit_price, quantity, total, etc.
    //   context.cart    — full CartDTO (may include item_total, subtotal)
    //   context.id      — cart ID
    let itemTotal = 0

    // 1. Try the nested cart DTO totals (most reliable when present)
    const cart = context?.cart
    if (cart?.item_total || cart?.item_subtotal || cart?.subtotal) {
      itemTotal = Number(cart.item_total ?? cart.item_subtotal ?? cart.subtotal ?? 0)
    }

    // 2. Sum context.items (Medusa always passes these with computed totals)
    if (itemTotal === 0 && Array.isArray(context?.items) && context.items.length > 0) {
      itemTotal = context.items.reduce(
        (sum: number, item: any) => {
          const lineTotal = Number(item.total ?? item.subtotal ?? 0)
          if (lineTotal > 0) return sum + lineTotal
          return sum + (Number(item.unit_price ?? 0) * Number(item.quantity ?? 1))
        },
        0
      )
    }

    // 3. Fallback: sum cart.items if context.items was empty
    if (itemTotal === 0 && Array.isArray(cart?.items) && cart.items.length > 0) {
      itemTotal = cart.items.reduce(
        (sum: number, item: any) => {
          const lineTotal = Number(item.total ?? item.subtotal ?? 0)
          if (lineTotal > 0) return sum + lineTotal
          return sum + (Number(item.unit_price ?? 0) * Number(item.quantity ?? 1))
        },
        0
      )
    }

    const amount =
      itemTotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_CHARGE

    logger.info(
      `itemTotal=${itemTotal}, threshold=${FREE_SHIPPING_THRESHOLD}, charge=${amount}, ` +
      `contextKeys=${Object.keys(context || {}).join(",")}, itemsLen=${context?.items?.length ?? "none"}`
    )

    return { calculated_amount: amount, is_calculated_price_tax_inclusive: false }
  }

  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return data
  }

  async validateOption(
    _data: Record<string, unknown>
  ): Promise<boolean> {
    return true
  }

  async createFulfillment(
    ..._args: Parameters<AbstractFulfillmentProviderService["createFulfillment"]>
  ): Promise<FulfillmentTypes.CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(): Promise<Record<string, unknown>> {
    return {}
  }

  async createReturnFulfillment(
    ..._args: Parameters<AbstractFulfillmentProviderService["createReturnFulfillment"]>
  ): Promise<FulfillmentTypes.CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }
}

export default ConditionalShippingService
