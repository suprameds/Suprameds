import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"
import { queryKeys } from "@/lib/utils/query-keys"

export type WishlistItem = {
  id: string
  product_id: string
  variant_id: string | null
  product_title: string | null
  product_handle: string | null
  thumbnail: string | null
  price_at_addition: number | null
  current_price: number | null
  alert_enabled: boolean
  alert_threshold_pct: number
  created_at: string
}

export const useWishlist = () => {
  return useQuery({
    queryKey: queryKeys.wishlist.list(),
    queryFn: async () => {
      const res = await sdk.client.fetch<{ wishlist: WishlistItem[]; count: number }>(
        "/store/wishlist",
        { method: "GET" }
      )
      return res
    },
    staleTime: 2 * 60 * 1000, // 2 min — mutations invalidate on changes
  })
}

export const useAddToWishlist = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      product_id: string
      variant_id?: string
      current_price?: number
    }) => {
      return sdk.client.fetch<{ wishlist_item: WishlistItem }>("/store/wishlist", {
        method: "POST",
        body: input,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all })
    },
  })
}

export const useRemoveFromWishlist = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { product_id: string }) => {
      return sdk.client.fetch<{ id: string; deleted: boolean }>("/store/wishlist", {
        method: "DELETE",
        body: input,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all })
    },
  })
}

export const useToggleWishlistAlert = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      alert_enabled?: boolean
      alert_threshold_pct?: number
    }) => {
      const { id, ...body } = input
      return sdk.client.fetch<{ wishlist_item: WishlistItem }>(
        `/store/wishlist/${id}/alert`,
        {
          method: "POST",
          body,
        }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all })
    },
  })
}

export const useIsWishlisted = (productId: string) => {
  const { data } = useWishlist()
  return data?.wishlist?.some((item) => item.product_id === productId) ?? false
}
