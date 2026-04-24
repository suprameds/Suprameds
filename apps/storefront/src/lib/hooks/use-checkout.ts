import { getStoredCart } from "@/lib/utils/cart"
import { queryKeys } from "@/lib/utils/query-keys"
import { sdk } from "@/lib/utils/sdk"
import { hapticNotification } from "@/lib/utils/haptics"
import { maybePromptReview } from "@/lib/utils/in-app-review"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

const DEFAULT_CART_FIELDS = "+items.*, +shipping_methods.*"

// ============ ADDRESSES ============

export const useSetCartAddresses = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const cartId = getStoredCart()
      if (!cartId) throw new Error("No cart found")

      const data = Object.fromEntries(formData.entries())

      const shippingAddress = {
        first_name: data["shipping_address.first_name"] as string,
        last_name: data["shipping_address.last_name"] as string,
        address_1: data["shipping_address.address_1"] as string,
        address_2: (data["shipping_address.address_2"] as string) || "",
        company: (data["shipping_address.company"] as string) || "",
        postal_code: data["shipping_address.postal_code"] as string,
        city: data["shipping_address.city"] as string,
        country_code: data["shipping_address.country_code"] as string,
        province: (data["shipping_address.province"] as string) || "",
        phone: (data["shipping_address.phone"] as string) || "",
      }

      const billingAddress = {
        first_name: data["billing_address.first_name"] as string,
        last_name: data["billing_address.last_name"] as string,
        address_1: data["billing_address.address_1"] as string,
        address_2: (data["billing_address.address_2"] as string) || "",
        company: (data["billing_address.company"] as string) || "",
        postal_code: data["billing_address.postal_code"] as string,
        city: data["billing_address.city"] as string,
        country_code: data["billing_address.country_code"] as string,
        province: (data["billing_address.province"] as string) || "",
        phone: (data["billing_address.phone"] as string) || "",
      }

      const email = data.email as string

      const { cart } = await sdk.store.cart.update(cartId, {
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        email,
      }, { fields: DEFAULT_CART_FIELDS })

      return cart
    },
    onSuccess: (cart) => {
      // Set cache immediately so checkout step guards see the updated cart
      // before the background refetch completes.
      queryClient.setQueriesData({ predicate: queryKeys.cart.predicate }, cart)
      queryClient.invalidateQueries({ predicate: queryKeys.cart.predicate })
    },
  })
}

// ============ SHIPPING ============

export const useShippingOptions = ({ cart_id }: { cart_id?: string } = {}) => {
  return useQuery({
    queryKey: queryKeys.shipping.options(cart_id || ""),
    queryFn: async () => {
      const cartId = cart_id || getStoredCart()
      if (!cartId) throw new Error("No cart found")
      const { shipping_options } = await sdk.store.fulfillment.listCartOptions({
        cart_id: cartId,
      })
      return shipping_options
    },
    enabled: !!cart_id || !!getStoredCart(),
    staleTime: 5 * 60 * 1000,
  })
}

export const useSetCartShippingMethod = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      shipping_option_id,
      data,
    }: {
      shipping_option_id: string;
      data?: Record<string, unknown>;
    }) => {
      const cartId = getStoredCart()
      if (!cartId) throw new Error("No cart found")
      const { cart } = await sdk.store.cart.addShippingMethod(
        cartId,
        { option_id: shipping_option_id, data }
      )
      return cart
    },
    onSuccess: async (cart) => {
      queryClient.setQueriesData({ predicate: queryKeys.cart.predicate }, cart)
      queryClient.invalidateQueries({ predicate: queryKeys.cart.predicate })
      queryClient.invalidateQueries({ queryKey: queryKeys.shipping.options(cart.id) })
    },
  })
}

// ============ PAYMENT ============

export const useCartPaymentMethods = ({
  region_id,
  fields,
}: {
  region_id?: string;
  fields?: string;
} = {}) => {
  return useQuery({
    queryKey: queryKeys.payments.sessions(region_id),
    queryFn: async () => {
      const { payment_providers } = await sdk.store.payment.listPaymentProviders({
        region_id: region_id!,
        fields
      })
      return payment_providers
    },
    enabled: !!region_id,
    staleTime: 5 * 60 * 1000,
  })
}

export const useInitiateCartPaymentSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      provider_id,
      data,
    }: {
      provider_id: string;
      data?: Record<string, unknown>;
    }) => {
      const cartId = getStoredCart()
      if (!cartId) throw new Error("No cart found")

      // Retrieve cart with payment_collection + existing sessions
      const { cart } = await sdk.store.cart.retrieve(cartId, {
        fields: "+payment_collection.payment_sessions",
      })
      if (!cart) throw new Error("Cart not found")

      // Smart reuse: if a pending session already exists for this provider, return it
      const existingSession = cart.payment_collection?.payment_sessions?.find(
        (s: any) => s.provider_id === provider_id && s.status === "pending"
      )
      if (existingSession) {
        return cart.payment_collection
      }

      // If collection exists, create session directly on it (avoids "already has collection" error)
      const collectionId = cart.payment_collection?.id
      if (collectionId) {
        try {
          const result = await sdk.client.fetch<{
            payment_collection: Record<string, unknown>
          }>(
            `/store/payment-collections/${collectionId}/payment-sessions`,
            { method: "POST", body: { provider_id, data } }
          )
          return result.payment_collection
        } catch (err: unknown) {
          // Session creation failed (e.g., Paytm/Razorpay API error) — don't propagate for COD
          if (provider_id === "pp_system_default") {
            // COD doesn't need a real payment session to proceed
            return cart.payment_collection
          }
          throw err
        }
      }

      // No collection yet — use SDK to create collection + session together
      try {
        const { payment_collection } = await sdk.store.payment.initiatePaymentSession(
          cart,
          { provider_id, data }
        )
        return payment_collection
      } catch (err: unknown) {
        // Fallback: collection was created by another concurrent call
        const { cart: freshCart } = await sdk.store.cart.retrieve(cartId, {
          fields: "+payment_collection.payment_sessions",
        })
        const freshCollectionId = freshCart?.payment_collection?.id
        if (!freshCollectionId) throw err

        const result = await sdk.client.fetch<{
          payment_collection: Record<string, unknown>
        }>(
          `/store/payment-collections/${freshCollectionId}/payment-sessions`,
          { method: "POST", body: { provider_id, data } }
        )
        return result.payment_collection
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: queryKeys.cart.predicate })
    },
  })
}

// ============ COMPLETE ORDER ============

export const useCompleteCartOrder = () => {
  const queryClient = useQueryClient()

  const clearCartCache = () => {
    queryClient.removeQueries({ predicate: queryKeys.cart.predicate })
    queryClient.removeQueries({ predicate: queryKeys.payments.predicate })
    queryClient.removeQueries({ predicate: queryKeys.shipping.predicate })
  }

  return useMutation({
    mutationFn: async () => {
      // Use completeCartOrder which has idempotency conflict retry logic —
      // Medusa rejects concurrent cart.complete() calls with an idempotency
      // error even on single clicks if the previous request is still running.
      const { completeCartOrder } = await import("@/lib/data/checkout/complete")
      return await completeCartOrder()
    },
    onSuccess: () => {
      void hapticNotification("success")
      // Remove (don't null-out) cart cache so useCart transitions to
      // isLoading=true. This prevents checkout's "empty cart → redirect
      // to cart" guard from racing the payment button's navigation to
      // the order confirmation page.
      clearCartCache()
      // Ask for Play Store review after the user's first few successful orders.
      void maybePromptReview()
    },
    onError: (error) => {
      void hapticNotification("error")
      // If the error indicates a concurrency issue (order likely placed),
      // completeCartOrder already called removeStoredCart(). Clear the
      // React Query cache too so the UI stops showing stale cart items.
      const msg = error instanceof Error ? error.message : ""
      if (msg.includes("likely placed") || msg.includes("My Orders")) {
        clearCartCache()
      }
    },
  })
}
