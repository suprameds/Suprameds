import { HttpTypes } from "@medusajs/types"
import { getStoredCart, removeStoredCart } from "@/lib/utils/cart"
import { sdk } from "@/lib/utils/sdk"
import { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/utils/query-keys"

/**
 * Completes the current cart and creates an order.
 * This is the final step in the checkout process that converts a cart to an order.
 * Clears the cart from storage after successful completion.
 * 
 * @returns Promise that resolves to the created order
 * @throws Error if no cart is found or order creation fails
 * 
 * @example
 * ```typescript
 * // Complete the current cart
 * const order = await completeCartOrder();
 * console.log('Order created:', order.id);
 * 
 * // In a checkout completion handler
 * const handleCompleteOrder = async () => {
 *   try {
 *     const order = await completeCartOrder();
 *     // Redirect to order confirmation page
 *     router.push(`/order/confirmed/${order.id}`);
 *   } catch (error) {
 *     console.error('Failed to complete order:', error);
 *     // Show error message to user
 *   }
 * };
 * 
 * // With order validation
 * const completeOrderWithValidation = async () => {
 *   // Ensure cart has required data before completing
 *   const cart = await retrieveCart();
 *   if (!cart?.shipping_address || !cart?.billing_address) {
 *     throw new Error('Missing required addresses');
 *   }
 *   if (!cart?.shipping_methods?.length) {
 *     throw new Error('No shipping method selected');
 *   }
 *   
 *   return await completeCartOrder();
 * };
 * ```
 */
export const completeCartOrder = async (): Promise<HttpTypes.StoreOrder> => {
  const cartId = getStoredCart()

  if (!cartId) {
    throw new Error("No cart found")
  }

  try {
    const cartRes = await sdk.store.cart.complete(cartId, {})

    if (cartRes.type !== "order") {
      throw new Error("Order creation failed")
    }

    // Clear the cart from storage after successful completion
    removeStoredCart()
    return cartRes.order
  } catch (err: any) {
    const msg = err?.message || err?.body?.message || ""

    const isConcurrencyError =
      msg.includes("conflicted") ||
      msg.includes("Idempotency") ||
      msg.includes("already being completed") ||
      msg.includes("acquire lock")

    // Idempotency / lock conflict — the order may have already been created
    // by a concurrent request. Wait for it to finish, then retry.
    if (isConcurrencyError) {
      // Wait longer — cart completion can take 5-8 seconds on first attempt
      await new Promise((r) => setTimeout(r, 4000))

      try {
        const retryRes = await sdk.store.cart.complete(cartId, {})
        if (retryRes.type === "order") {
          removeStoredCart()
          return retryRes.order
        }
      } catch (retryErr: any) {
        const retryMsg = retryErr?.message || ""
        const isStillConcurrency =
          retryMsg.includes("conflicted") ||
          retryMsg.includes("Idempotency") ||
          retryMsg.includes("already being completed") ||
          retryMsg.includes("acquire lock")

        // Still conflicting — wait longer and try once more
        if (isStillConcurrency) {
          await new Promise((r) => setTimeout(r, 5000))
          try {
            const finalRes = await sdk.store.cart.complete(cartId, {})
            if (finalRes.type === "order") {
              removeStoredCart()
              return finalRes.order
            }
          } catch {
            // Final retry also failed — fall through to clear cart below
          }
        }
      }

      // All retries exhausted. The order was very likely placed by the
      // first request. Clear the stale cart so the user isn't stuck with
      // a completed cart that can't be used again.
      removeStoredCart()
      throw new Error(
        "Your order was likely placed successfully. " +
        "Please check My Orders to confirm. " +
        "If your order isn't there, contact support."
      )
    }

    throw err
  }
}

/**
 * Clears all cart-related data from the query cache.
 * This is typically called after successful order completion to reset the UI state.
 * 
 * @param query_client - The Tanstack Query client instance
 * 
 * @example
 * ```typescript
 * // Clear cart data after order completion
 * const queryClient = useQueryClient();
 * clearAllCartData({ query_client: queryClient });
 * 
 * // In a custom hook
 * const useOrderCompletion = () => {
 *   const queryClient = useQueryClient();
 *   
 *   const completeOrder = async () => {
 *     try {
 *       const order = await completeCartOrder();
 *       clearAllCartData({ query_client: queryClient });
 *       return order;
 *     } catch (error) {
 *       console.error('Order completion failed:', error);
 *       throw error;
 *     }
 *   };
 *   
 *   return { completeOrder };
 * };
 * 
 * // Manual cart reset
 * const resetCart = () => {
 *   clearAllCartData({ query_client: queryClient });
 *   // Additional cleanup if needed
 *   removeCartId();
 * };
 * ```
 */
export const clearAllCartData = ({
  query_client,
}: {
  query_client: QueryClient;
}) => {
  // Immediately set cart data to null to clear the UI
  query_client.setQueriesData({
    predicate: queryKeys.cart.predicate,
  }, null)

  // Clear payment methods cache
  query_client.removeQueries({ predicate: queryKeys.payments.predicate })

  // Clear shipping options cache
  query_client.removeQueries({ predicate: queryKeys.shipping.predicate })

  // Invalidate cart queries to trigger a fresh fetch with no cart ID
  query_client.invalidateQueries({ predicate: queryKeys.cart.predicate })
}
