import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { HttpTypes } from "@medusajs/types"
import { queryKeys } from "@/lib/utils/query-keys"
import { sdk } from "@/lib/utils/sdk"
import {
  getStoredCart,
  setStoredCart,
  removeStoredCart,
  getStoredCartRegion,
  setStoredCartRegion,
  addItemOptimistically,
  createOptimisticCartItem,
  getCurrentCart,
  rollbackOptimisticCart,
  updateLineItemOptimistically,
  removeLineItemOptimistically,
  createOptimisticCart,
} from "@/lib/utils/cart"

/**
 * Thrown by `useAddToCart` when an unauthenticated user attempts to add
 * an item. Carries a `pendingAction` token (e.g. `add_to_cart:variant_xxx`)
 * that the login round-trip preserves so the original intent can be
 * replayed once the user authenticates. Defense-in-depth: button-level
 * `useRequireAuth` is the primary gate; this is the safety net for any
 * caller that bypasses the UI.
 */
export class AuthRequiredError extends Error {
  pendingAction: string
  constructor(pendingAction: string) {
    super("Authentication required")
    this.name = "AuthRequiredError"
    this.pendingAction = pendingAction
  }
}

const DEFAULT_CART_FIELDS = "+items.total, +shipping_methods.name"

// Module-level lock to prevent concurrent cart creation across hooks.
// Without this, two simultaneous useAddToCart calls can both see
// cartId=null and each create a new cart, orphaning the first one.
let _cartCreationPromise: Promise<string> | null = null

export const useCart = ({ fields }: { fields?: string } = {}) => {
  return useQuery({
    queryKey: queryKeys.cart.current(fields),
    queryFn: async () => {
      const id = getStoredCart()
      if (!id) return null
      try {
        const { cart } = await sdk.store.cart.retrieve(id, {
          fields: fields || DEFAULT_CART_FIELDS,
        })
        // If the cart was already completed into an order, discard it
        // so subsequent add-to-cart creates a fresh one.
        if ((cart as any).completed_at) {
          removeStoredCart()
          return null
        }
        if (cart.region_id) setStoredCartRegion(cart.region_id)
        return cart
      } catch {
        // Cart no longer exists on the server (deleted, expired, etc.)
        removeStoredCart()
        return null
      }
    },
    staleTime: 30 * 1000, // 30s — mutations invalidate cache; avoid refetch on every mount
  })
}

export const useUpdateCart = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      fields = DEFAULT_CART_FIELDS,
      ...updates
    }: HttpTypes.StoreUpdateCart & { fields?: string }) => {
      const cartId = getStoredCart()
      if (!cartId) throw new Error("No cart found")
      const { cart } = await sdk.store.cart.update(cartId, updates, { fields })
      return cart
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: queryKeys.cart.predicate })
    }
  })
}

export const useCreateCart = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      region_id,
      fields = DEFAULT_CART_FIELDS,
    }: {
      region_id: string;
      fields?: string;
    }) => {
      const { cart } = await sdk.store.cart.create({ region_id }, { fields })
      setStoredCart(cart.id)
      setStoredCartRegion(region_id)
      return cart
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: queryKeys.cart.predicate })
    },
  })
}

export const useAddToCart = ({ fields }: { fields?: string } = {}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (variables: {
      variant_id: string;
      quantity: number;
      country_code: string;
      fields?: string;
      product?: HttpTypes.StoreProduct;
      variant?: HttpTypes.StoreProductVariant;
      region?: HttpTypes.StoreRegion;
    }) => {
      const { variant_id, quantity, country_code, fields: requestFields } = variables
      if (!variant_id) throw new Error("Missing variant ID when adding to cart")

      // Defense-in-depth auth gate. Button-level `useRequireAuth` is the
      // primary UX path (toast + redirect with pendingAction); this throw
      // protects any caller that bypasses the button gate.
      // Read imperatively from the cache so this hook doesn't subscribe
      // every consumer (e.g. each card on a listing page) to the customer
      // query — window-focus refetches would otherwise cascade re-renders.
      const customer = queryClient.getQueryData(queryKeys.customer.current())
      if (!customer) {
        throw new AuthRequiredError(`add_to_cart:${variant_id}`)
      }

      const normalizedCountryCode = country_code.toLowerCase()

      // Try cached regions first to avoid an extra API call on every add-to-cart
      let regions = queryClient.getQueryData<HttpTypes.StoreRegion[]>(queryKeys.regions.list())
      if (!regions) {
        const res = await sdk.store.region.list({})
        regions = res.regions
        queryClient.setQueryData(queryKeys.regions.list(), regions)
      }
      const targetRegion = regions.find((r) =>
        r.countries?.some((c) => c.iso_2 === normalizedCountryCode)
      )

      if (!targetRegion) {
        throw new Error(`Region not found for country code: ${country_code}`)
      }

      let cartId = getStoredCart()
      const lineItemFields = requestFields || fields || DEFAULT_CART_FIELDS

      if (!cartId) {
        // Use a module-level lock so concurrent add-to-cart calls share
        // the same cart creation promise instead of each creating one.
        if (!_cartCreationPromise) {
          _cartCreationPromise = sdk.store.cart.create({ region_id: targetRegion.id }, {
            fields: lineItemFields,
          }).then(({ cart }) => {
            setStoredCart(cart.id)
            setStoredCartRegion(targetRegion.id)
            return cart.id
          }).finally(() => { _cartCreationPromise = null })
        }
        cartId = await _cartCreationPromise
      } else if (getStoredCartRegion() !== targetRegion.id) {
        // Stored region missing or different — verify with the server before
        // adding to avoid Medusa price-resolution failures on region mismatch.
        try {
          const { cart: existingCart } = await sdk.store.cart.retrieve(cartId, {
            fields: "id,region_id",
          })

          if ((existingCart as any).completed_at || existingCart.region_id !== targetRegion.id) {
            const { cart } = await sdk.store.cart.create(
              { region_id: targetRegion.id },
              { fields: lineItemFields }
            )
            setStoredCart(cart.id)
            setStoredCartRegion(targetRegion.id)
            cartId = cart.id
          } else if (existingCart.region_id) {
            // Backfill the region cache so subsequent adds skip the preflight.
            setStoredCartRegion(existingCart.region_id)
          }
        } catch {
          // Stored cart may be stale/deleted; recreate for current region.
          const { cart } = await sdk.store.cart.create(
            { region_id: targetRegion.id },
            { fields: lineItemFields }
          )
          setStoredCart(cart.id)
          setStoredCartRegion(targetRegion.id)
          cartId = cart.id
        }
      }
      // else: stored region matches target — skip preflight retrieve entirely.

      try {
        const response = await sdk.store.cart.createLineItem(
          cartId,
          { variant_id, quantity },
          { fields: lineItemFields }
        )
        return response.cart
      } catch (err) {
        // If the stored cart was garbage-collected on the server (404) or the
        // cached region is wrong, recreate the cart and retry once. Without
        // this, a stale region cache would loop on every retry.
        removeStoredCart()
        const { cart: newCart } = await sdk.store.cart.create(
          { region_id: targetRegion.id },
          { fields: lineItemFields }
        )
        setStoredCart(newCart.id)
        setStoredCartRegion(targetRegion.id)
        try {
          const retry = await sdk.store.cart.createLineItem(
            newCart.id,
            { variant_id, quantity },
            { fields: lineItemFields }
          )
          return retry.cart
        } catch {
          // If the retry also fails, surface the original error so the user
          // sees the real problem rather than a generic recreate failure.
          throw err
        }
      }
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ predicate: queryKeys.cart.predicate })
      let previousCart = getCurrentCart(queryClient, fields)
      let didCartExist = true

      if (!previousCart && variables.region) {
        previousCart = createOptimisticCart(variables.region)
        didCartExist = false
      }

      if (previousCart && variables.product && variables.variant) {
        const optimisticItem = createOptimisticCartItem(
          variables.variant,
          variables.product,
          variables.quantity
        )
        addItemOptimistically(queryClient, optimisticItem, previousCart, fields)
      }

      return { previousCart: didCartExist ? previousCart : undefined }
    },
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        rollbackOptimisticCart(queryClient, context.previousCart, fields)
      }
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({
        predicate: (query) => queryKeys.cart.predicate(query, fields && data ? [fields] : undefined)
      })
      if (data) {
        queryClient.setQueryData(queryKeys.cart.current(fields), data)
      }
    },
  })
}

export const useUpdateLineItem = ({ fields }: { fields?: string } = {}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (variables: { line_id: string; quantity: number }) => {
      const cartId = getStoredCart()
      if (!cartId) throw new Error("No cart found")
      const { cart } = await sdk.store.cart.updateLineItem(
        cartId,
        variables.line_id,
        { quantity: variables.quantity },
        { fields: fields || DEFAULT_CART_FIELDS }
      )
      return cart
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        predicate: (query) => queryKeys.cart.predicate(query, fields ? [fields] : undefined)
      })
      const previousCart = getCurrentCart(queryClient, fields)
      if (previousCart) {
        updateLineItemOptimistically(queryClient, variables.line_id, variables.quantity, fields)
      }
      return { previousCart }
    },
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        rollbackOptimisticCart(queryClient, context.previousCart, fields)
      }
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({
        predicate: (query) => queryKeys.cart.predicate(query, fields && data ? [fields] : undefined)
      })
      if (data) {
        queryClient.setQueryData(queryKeys.cart.current(fields), data)
      }
    },
  })
}

export const useDeleteLineItem = ({ fields }: { fields?: string } = {}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (variables: { line_id: string }) => {
      const cartId = getStoredCart()
      if (!cartId) throw new Error("No cart found")
      await sdk.store.cart.deleteLineItem(cartId, variables.line_id)
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        predicate: (query) => queryKeys.cart.predicate(query, fields ? [fields] : undefined)
      })
      const previousCart = getCurrentCart(queryClient, fields)
      if (previousCart) {
        removeLineItemOptimistically(queryClient, variables.line_id, fields)
      }
      return { previousCart }
    },
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        rollbackOptimisticCart(queryClient, context.previousCart, fields)
      }
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({
        predicate: (query) => queryKeys.cart.predicate(query, fields && data ? [fields] : undefined)
      })
      if (data) {
        queryClient.setQueryData(queryKeys.cart.current(fields), data)
      }
    },
  })
}

export const useApplyPromoCode = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      const cartId = getStoredCart()
      if (!cartId) throw new Error("No cart found")
      const { cart } = await sdk.client.fetch<{ cart: HttpTypes.StoreCart }>(
        `/store/carts/${cartId}/promotions`,
        {
          method: "POST",
          body: { promo_codes: [code] },
        }
      )
      return cart
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: queryKeys.cart.predicate })
    },
  })
}

export const useRemovePromoCode = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      const cartId = getStoredCart()
      if (!cartId) throw new Error("No cart found")
      const { cart } = await sdk.client.fetch<{ cart: HttpTypes.StoreCart }>(
        `/store/carts/${cartId}/promotions`,
        {
          method: "DELETE",
          body: { promo_codes: [code] },
        }
      )
      return cart
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: queryKeys.cart.predicate })
    },
  })
}

// ── Loyalty Points Redemption ──────────────────────────────────────

type LoyaltyRedeemResponse = {
  success: boolean
  points_applied: number
  discount_amount: number
  points_remaining: number
}

export const useRedeemLoyaltyPoints = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ points }: { points: number }) => {
      const cartId = getStoredCart()
      if (!cartId) throw new Error("No cart found")
      return await sdk.client.fetch<LoyaltyRedeemResponse>(
        `/store/carts/${cartId}/loyalty-redeem`,
        { method: "POST", body: { points } }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: queryKeys.cart.predicate })
    },
  })
}

export const useRemoveLoyaltyPoints = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const cartId = getStoredCart()
      if (!cartId) throw new Error("No cart found")
      return await sdk.client.fetch<{ success: boolean; points_removed: number }>(
        `/store/carts/${cartId}/loyalty-redeem`,
        { method: "DELETE" }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: queryKeys.cart.predicate })
    },
  })
}
