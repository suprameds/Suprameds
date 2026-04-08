import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"
import { queryKeys } from "@/lib/utils/query-keys"
import { getStoredOtpToken } from "@/lib/hooks/use-customer"

// ── Types ────────────────────────────────────────────────────────────

interface WalletTransaction {
  id: string
  type: "credit" | "debit"
  amount: number
  reference_type: "return" | "cancellation" | "manual" | "checkout"
  reference_id: string | null
  reason: string | null
  created_at: string
}

interface WalletApiResponse {
  wallet: {
    id: string
    balance: number
    currency_code: string
  }
  transactions: WalletTransaction[]
}

interface WalletApplyResponse {
  wallet: {
    id: string
    balance: number
    applied_amount: number
    currency_code: string
  }
}

// ── Helper: auth headers for OTP-based login ────────────────────────

function getAuthHeaders(): Record<string, string> {
  const otpToken = getStoredOtpToken()
  return otpToken ? { Authorization: `Bearer ${otpToken}` } : {}
}

// ── Hooks ────────────────────────────────────────────────────────────

/**
 * Fetch wallet balance and recent transactions.
 */
export const useWallet = () => {
  return useQuery({
    queryKey: queryKeys.wallet.balance(),
    queryFn: async () => {
      const response = await sdk.client.fetch<WalletApiResponse>(
        "/store/wallet",
        { headers: getAuthHeaders() }
      )
      return response
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 1,
  })
}

/**
 * Apply wallet balance to cart.
 * Invalidates wallet and cart queries on success.
 */
export const useApplyWallet = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      cart_id,
      amount,
    }: {
      cart_id: string
      amount: number
    }) => {
      const response = await sdk.client.fetch<WalletApplyResponse>(
        "/store/wallet/apply",
        {
          method: "POST",
          body: { cart_id, amount },
          headers: getAuthHeaders(),
        }
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() })
      queryClient.invalidateQueries({ predicate: queryKeys.cart.predicate })
    },
  })
}

/**
 * Remove wallet balance from cart.
 * Invalidates wallet and cart queries on success.
 */
export const useRemoveWallet = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ cart_id }: { cart_id: string }) => {
      const response = await sdk.client.fetch<{ success: boolean }>(
        "/store/wallet/remove",
        {
          method: "DELETE",
          body: { cart_id },
          headers: getAuthHeaders(),
        }
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.balance() })
      queryClient.invalidateQueries({ predicate: queryKeys.cart.predicate })
    },
  })
}
