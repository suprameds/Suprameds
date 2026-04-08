import { Button } from "@/components/ui/button"
import { useRedeemLoyaltyPoints, useRemoveLoyaltyPoints } from "@/lib/hooks/use-cart"
import { sdk } from "@/lib/utils/sdk"
import { queryKeys } from "@/lib/utils/query-keys"
import { getStoredOtpToken } from "@/lib/hooks/use-customer"
import { HttpTypes } from "@medusajs/types"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

/** Loyalty redemption widget for the cart/checkout order summary */
export function LoyaltyRedeem({ cart }: { cart: HttpTypes.StoreCart }) {
  const [inputPoints, setInputPoints] = useState("")
  const [error, setError] = useState("")

  const redeemMutation = useRedeemLoyaltyPoints()
  const removeMutation = useRemoveLoyaltyPoints()

  // Fetch customer loyalty account
  const { data: account, isLoading } = useQuery({
    queryKey: queryKeys.loyalty.account(),
    queryFn: async () => {
      const otpToken = getStoredOtpToken()
      const headers: Record<string, string> = {}
      if (otpToken) headers.Authorization = `Bearer ${otpToken}`

      const raw = await sdk.client.fetch<{
        account: { points_balance: number; tier: string }
      }>("/store/loyalty/account", { method: "GET", headers })

      return raw.account
    },
    retry: false,
  })

  const meta = (cart.metadata ?? {}) as Record<string, any>
  const pointsRedeemed = Number(meta.loyalty_points_redeemed ?? 0)
  const discountAmount = Number(meta.loyalty_discount_amount ?? 0)
  const balance = account?.points_balance ?? 0

  // Don't show if no account or zero balance and nothing redeemed
  if (isLoading || (!account && !pointsRedeemed)) return null
  if (balance === 0 && !pointsRedeemed) return null

  const handleApply = () => {
    setError("")
    const points = parseInt(inputPoints, 10)

    if (!points || points <= 0) {
      setError("Enter a valid number of points")
      return
    }

    if (points > balance) {
      setError(`You only have ${balance} points`)
      return
    }

    redeemMutation.mutate(
      { points },
      {
        onSuccess: () => setInputPoints(""),
        onError: (err) =>
          setError(err instanceof Error ? err.message : "Failed to apply points"),
      }
    )
  }

  const handleRemove = () => {
    setError("")
    removeMutation.mutate(undefined, {
      onError: (err) =>
        setError(err instanceof Error ? err.message : "Failed to remove points"),
    })
  }

  const handleUseAll = () => {
    setError("")
    const maxPoints = Math.min(balance, Math.floor(Number(cart.subtotal ?? cart.total ?? 0)))
    if (maxPoints <= 0) return

    redeemMutation.mutate(
      { points: maxPoints },
      {
        onSuccess: () => setInputPoints(""),
        onError: (err) =>
          setError(err instanceof Error ? err.message : "Failed to apply points"),
      }
    )
  }

  return (
    <div
      className="rounded-lg border p-3 mt-3"
      style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M16 8l-8 8M8 8l8 8" />
        </svg>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Loyalty Points
        </span>
        <span className="text-xs ml-auto" style={{ color: "var(--text-tertiary)" }}>
          Balance: {balance} pts
        </span>
      </div>

      {pointsRedeemed > 0 ? (
        /* Already redeemed — show applied state */
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium" style={{ color: "var(--brand-green)" }}>
              {pointsRedeemed} points applied
            </span>
            <span className="text-xs ml-2" style={{ color: "var(--text-tertiary)" }}>
              (-&#8377;{discountAmount.toFixed(2)})
            </span>
          </div>
          <button
            onClick={handleRemove}
            disabled={removeMutation.isPending}
            className="text-xs underline cursor-pointer"
            style={{ color: "var(--brand-red)" }}
          >
            {removeMutation.isPending ? "Removing..." : "Remove"}
          </button>
        </div>
      ) : (
        /* Input to redeem */
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={balance}
              value={inputPoints}
              onChange={(e) => setInputPoints(e.target.value)}
              placeholder={`Up to ${balance} pts`}
              className="flex-1 rounded-md border px-2 py-1.5 text-sm"
              style={{
                borderColor: "var(--border-primary)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
              }}
            />
            <Button
              size="fit"
              onClick={handleApply}
              disabled={redeemMutation.isPending || !inputPoints}
            >
              {redeemMutation.isPending ? "..." : "Apply"}
            </Button>
          </div>
          <button
            onClick={handleUseAll}
            disabled={redeemMutation.isPending}
            className="text-xs underline cursor-pointer self-start"
            style={{ color: "var(--brand-teal)" }}
          >
            Use all {balance} points (-&#8377;{Math.min(balance, Math.floor(Number(cart.subtotal ?? 0))).toFixed(2)} off)
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs mt-1" style={{ color: "var(--brand-red)" }}>
          {error}
        </p>
      )}

      <p className="text-[10px] mt-2" style={{ color: "var(--text-tertiary)" }}>
        1 point = &#8377;1 discount. Earn 1 point per &#8377;50 spent on OTC.
      </p>
    </div>
  )
}
