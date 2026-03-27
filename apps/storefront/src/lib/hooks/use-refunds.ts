import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"
import { queryKeys } from "@/lib/utils/query-keys"

export type ReturnReason =
  | "wrong_product"
  | "damaged"
  | "near_expiry"
  | "batch_recall"
  | "other"

export type ReturnRequestItem = {
  line_item_id: string
  quantity: number
  reason: ReturnReason
}

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  wrong_product: "Wrong product delivered",
  damaged: "Damaged on arrival",
  near_expiry: "Near expiry (< 30 days)",
  batch_recall: "Batch recall",
  other: "Other",
}

export function useReturnRequest(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      items,
      notes,
    }: {
      items: ReturnRequestItem[]
      notes?: string
    }) => {
      return sdk.client.fetch(`/store/orders/${orderId}/return-request`, {
        method: "POST",
        body: { items, notes },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.customer.orders() })
    },
  })
}
