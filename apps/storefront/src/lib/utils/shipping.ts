/**
 * Centralized shipping constants and helpers.
 * Single source of truth — used by cart display and backend fulfillment provider.
 */

/** Minimum order subtotal (INR) for free delivery */
export const FREE_DELIVERY_THRESHOLD = 300

/** Standard shipping charge (INR) when below threshold */
export const STANDARD_SHIPPING_CHARGE = 50

/** Check if a subtotal qualifies for free delivery */
export function isEligibleForFreeDelivery(subtotal: number): boolean {
  return subtotal >= FREE_DELIVERY_THRESHOLD
}

/** How much more the customer needs to spend for free delivery */
export function calculateDeliveryRemaining(subtotal: number): number {
  return Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal)
}
