import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import type { FulfillmentTypes } from "@medusajs/types"

/**
 * Custom fulfillment provider for conditional shipping pricing.
 *
 * - Cart item_total >= ₹300 → free shipping (₹0)
 * - Cart item_total <  ₹300 → standard charge (₹50)
 *
 * Medusa stores amounts in whole currency units (₹50 = 50, not 5000).
 */

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
    const cart = context?.cart
    const itemTotal =
      cart?.item_total ?? cart?.item_subtotal ?? cart?.subtotal ?? 0

    const amount =
      itemTotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_CHARGE

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
