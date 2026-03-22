import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

type LoyaltyAccount = {
  id: string
  customer_id: string
  points_balance: number
  lifetime_points: number
  tier: string
  referral_code: string | null
}

type LoyaltyTransaction = {
  id: string
  type: "earn" | "burn" | "expire" | "adjust"
  points: number
  reason: string | null
  reference_type: string | null
  reference_id: string | null
  created_at: string
}

const tierColor = (t: string): "grey" | "blue" | "orange" | "purple" => {
  const map: Record<string, "grey" | "blue" | "orange" | "purple"> = {
    bronze: "grey",
    silver: "blue",
    gold: "orange",
    platinum: "purple",
  }
  return map[t] ?? "grey"
}

const txBadge = (type: string) => {
  const map: Record<string, "green" | "red" | "orange" | "blue"> = {
    earn: "green",
    burn: "red",
    expire: "orange",
    adjust: "blue",
  }
  return map[type] ?? "grey"
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Tier thresholds for the progress indicator
const TIER_THRESHOLDS: [string, number][] = [
  ["Platinum", 5000],
  ["Gold", 2000],
  ["Silver", 500],
  ["Bronze", 0],
]

const nextTierInfo = (lifetime: number) => {
  for (const [name, threshold] of TIER_THRESHOLDS) {
    if (lifetime < threshold) {
      return { name, threshold, remaining: threshold - lifetime }
    }
  }
  return null
}

const CustomerLoyaltyWidget = ({ data: customer }: { data: { id: string } }) => {
  const [account, setAccount] = useState<LoyaltyAccount | null>(null)
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customer?.id) return

    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/admin/loyalty/customer/${customer.id}`, {
          credentials: "include",
        })
        if (!res.ok) throw new Error()
        const json = await res.json()
        setAccount(json.account ?? null)
        setTransactions(json.transactions ?? [])
      } catch {
        setAccount(null)
        setTransactions([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [customer?.id])

  if (loading) {
    return (
      <Container>
        <Heading level="h2">Loyalty</Heading>
        <Text className="text-ui-fg-subtle mt-2">Loading...</Text>
      </Container>
    )
  }

  if (!account) {
    return (
      <Container>
        <Heading level="h2">Loyalty</Heading>
        <Text className="text-ui-fg-subtle mt-2">
          No loyalty account for this customer. An account will be created
          automatically when they place their first OTC order.
        </Text>
      </Container>
    )
  }

  const next = nextTierInfo(account.lifetime_points)

  return (
    <Container>
      <div className="flex items-center justify-between mb-4">
        <Heading level="h2">Loyalty</Heading>
        <Badge color={tierColor(account.tier)}>{cap(account.tier)} Tier</Badge>
      </div>

      {/* Points Summary */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 rounded-lg border border-ui-border-base">
          <Text className="text-xs text-ui-fg-subtle">Current Balance</Text>
          <Text className="text-xl font-semibold">{account.points_balance.toLocaleString("en-IN")}</Text>
        </div>
        <div className="p-3 rounded-lg border border-ui-border-base">
          <Text className="text-xs text-ui-fg-subtle">Lifetime Earned</Text>
          <Text className="text-xl font-semibold">{account.lifetime_points.toLocaleString("en-IN")}</Text>
        </div>
      </div>

      {/* Next tier progress */}
      {next && (
        <div className="p-3 bg-ui-bg-subtle rounded-lg mb-4">
          <Text className="text-xs text-ui-fg-subtle">
            {next.remaining.toLocaleString("en-IN")} points to {next.name}
          </Text>
          <div className="w-full bg-ui-bg-base rounded-full h-2 mt-1.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--suprameds-green)]"
              style={{
                width: `${Math.min(100, (account.lifetime_points / next.threshold) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {account.referral_code && (
        <div className="mb-4">
          <Text className="text-xs text-ui-fg-subtle">Referral Code</Text>
          <Text className="font-mono text-sm">{account.referral_code}</Text>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="border-t border-ui-border-base pt-3">
        <Text className="text-sm font-semibold mb-2">Recent Transactions</Text>
        {transactions.length === 0 ? (
          <Text className="text-sm text-ui-fg-subtle">No transactions yet.</Text>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {transactions.slice(0, 15).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-ui-border-base last:border-0">
                <div className="flex items-center gap-2">
                  <Badge color={txBadge(tx.type)} className="text-xs">{cap(tx.type)}</Badge>
                  <Text className="text-sm text-ui-fg-subtle">{tx.reason || tx.reference_type || "—"}</Text>
                </div>
                <div className="text-right">
                  <Text className={`text-sm font-medium ${tx.points > 0 ? "text-green-600" : "text-red-500"}`}>
                    {tx.points > 0 ? "+" : ""}{tx.points}
                  </Text>
                  <Text className="text-xs text-ui-fg-muted block">
                    {new Date(tx.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short",
                    })}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "customer.details.after",
})

export default CustomerLoyaltyWidget
