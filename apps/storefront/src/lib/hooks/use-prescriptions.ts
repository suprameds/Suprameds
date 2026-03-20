import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"
import { queryKeys } from "@/lib/utils/query-keys"

// ── Types ───────────────────────────────────────────────────────────

export interface PrescriptionSummary {
  id: string
  status: "pending_review" | "approved" | "rejected" | "expired" | "used"
  file_url: string | null
  original_filename: string | null
  doctor_name: string | null
  patient_name: string | null
  valid_until: string | null
  created_at: string
}

export interface CartRxStatus {
  has_rx_items: boolean
  rx_product_ids: string[]
  prescription_id: string | null
  prescription: PrescriptionSummary | null
}

// ── List customer prescriptions ────────────────────────────────────

export const useCustomerPrescriptions = (
  options: { status?: string; enabled?: boolean } = {}
) => {
  const { status, enabled = true } = options
  return useQuery<PrescriptionSummary[]>({
    queryKey: queryKeys.prescriptions.forCustomer(status),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) params.set("status", status)

      const url = `/store/prescriptions${params.toString() ? `?${params}` : ""}`
      const res = await sdk.client.fetch<{
        prescriptions: PrescriptionSummary[]
      }>(url, { method: "GET" })

      return res.prescriptions
    },
    staleTime: 1000 * 30,
    // Only fetch when the caller confirms the user is authenticated —
    // prevents a guaranteed-to-fail 401 for guest checkout flows.
    enabled,
  })
}

// ── Cart Rx status (has Rx items? which prescription is attached?) ──

export const useCartRxStatus = (cartId: string | undefined) => {
  return useQuery<CartRxStatus>({
    queryKey: queryKeys.prescriptions.cartRxStatus(cartId ?? ""),
    queryFn: async () => {
      const res = await sdk.client.fetch<CartRxStatus>(
        `/store/carts/${cartId}/prescription`,
        { method: "GET" }
      )
      return res
    },
    enabled: !!cartId,
    staleTime: 0,
    refetchOnMount: true,
  })
}

// ── Attach prescription to cart ────────────────────────────────────

export const useAttachPrescription = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      cartId,
      prescriptionId,
    }: {
      cartId: string
      prescriptionId: string | null
    }) => {
      const res = await sdk.client.fetch<{
        cart_id: string
        prescription_id: string | null
        attached: boolean
      }>(`/store/carts/${cartId}/prescription`, {
        method: "POST",
        body: { prescription_id: prescriptionId },
      })
      return res
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.prescriptions.cartRxStatus(variables.cartId),
      })
      queryClient.invalidateQueries({
        predicate: queryKeys.cart.predicate,
      })
    },
  })
}

// ── Upload new prescription ────────────────────────────────────────

interface UploadPrescriptionInput {
  file_key: string
  file_url: string
  original_filename: string
  mime_type: string
  file_size_bytes: number
}

export const useUploadPrescription = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: UploadPrescriptionInput
    ): Promise<{ prescription: PrescriptionSummary }> => {
      const res = await sdk.client.fetch<{
        prescription: PrescriptionSummary
      }>("/store/prescriptions", {
        method: "POST",
        body: input,
      })
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.prescriptions.all,
      })
    },
  })
}
