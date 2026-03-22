import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Heading, Table, Text } from "@medusajs/ui"
import { Star } from "@medusajs/icons"
import { useEffect, useState } from "react"
import { sdk } from "../../lib/client"

type LoyaltyAccount = {
  id: string
  customer_id: string
  points_balance: number
  lifetime_points: number
  tier: "bronze" | "silver" | "gold" | "platinum"
  created_at: string
}

type TierDistribution = {
  bronze: number
  silver: number
  gold: number
  platinum: number
}

type LoyaltySummary = {
  total_accounts: number
  total_points_outstanding: number
  total_lifetime_points: number
  tier_distribution: TierDistribution
  accounts: LoyaltyAccount[]
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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-base">
    <Text className="text-xs text-ui-fg-subtle uppercase tracking-wide">{label}</Text>
    <Text className="text-2xl font-semibold mt-1">{value}</Text>
    {sub && <Text className="text-xs text-ui-fg-muted mt-0.5">{sub}</Text>}
  </div>
)

const TierBar = ({ label, count, total }: { label: string; count: number; total: number }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const colorMap: Record<string, string> = {
    Bronze: "bg-ui-fg-subtle",
    Silver: "bg-blue-400",
    Gold: "bg-amber-400",
    Platinum: "bg-purple-500",
  }
  return (
    <div className="flex items-center gap-3">
      <Text className="text-sm w-20 text-right">{label}</Text>
      <div className="flex-1 bg-ui-bg-subtle rounded-full h-5 overflow-hidden">
        <div className={`h-full rounded-full ${colorMap[label] ?? "bg-ui-fg-subtle"}`} style={{ width: `${pct}%` }} />
      </div>
      <Text className="text-sm w-16">{count} ({pct}%)</Text>
    </div>
  )
}

const LoyaltyPage = () => {
  const [data, setData] = useState<LoyaltySummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true)
      try {
        const json = await sdk.client.fetch<LoyaltySummary>("/admin/loyalty")
        setData(json)
      } catch (err) {
        console.error("[loyalty-admin] Failed to load:", err)
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    fetchSummary()
  }, [])

  if (loading) {
    return (
      <Container>
        <Heading level="h1" className="mb-4">Loyalty Program</Heading>
        <Text className="text-ui-fg-subtle">Loading loyalty data...</Text>
      </Container>
    )
  }

  if (!data) {
    return (
      <Container>
        <Heading level="h1" className="mb-4">Loyalty Program</Heading>
        <Text className="text-ui-fg-subtle">
          Unable to load loyalty data. Make sure the admin API route is configured.
        </Text>
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary Cards */}
      <Container className="p-6">
        <Heading level="h1" className="mb-6">Loyalty Program Dashboard</Heading>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Total Accounts"
            value={data.total_accounts.toLocaleString("en-IN")}
          />
          <StatCard
            label="Points Outstanding"
            value={data.total_points_outstanding.toLocaleString("en-IN")}
            sub="Redeemable across all customers"
          />
          <StatCard
            label="Lifetime Points Issued"
            value={data.total_lifetime_points.toLocaleString("en-IN")}
          />
        </div>

        {/* Tier Distribution */}
        <div className="p-4 border border-ui-border-base rounded-lg">
          <Text className="text-sm font-semibold mb-3">Tier Distribution</Text>
          <div className="flex flex-col gap-2">
            <TierBar label="Platinum" count={data.tier_distribution.platinum} total={data.total_accounts} />
            <TierBar label="Gold" count={data.tier_distribution.gold} total={data.total_accounts} />
            <TierBar label="Silver" count={data.tier_distribution.silver} total={data.total_accounts} />
            <TierBar label="Bronze" count={data.tier_distribution.bronze} total={data.total_accounts} />
          </div>
        </div>
      </Container>

      {/* Accounts Table */}
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">All Loyalty Accounts</Heading>
        </div>
        {data.accounts.length === 0 ? (
          <div className="flex justify-center p-6">
            <Text className="text-ui-fg-subtle">No loyalty accounts yet.</Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Customer ID</Table.HeaderCell>
                <Table.HeaderCell>Tier</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Balance</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Lifetime</Table.HeaderCell>
                <Table.HeaderCell>Joined</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.accounts.map((acct) => (
                <Table.Row key={acct.id}>
                  <Table.Cell>
                    <Text className="font-mono text-sm">{acct.customer_id.slice(-12)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={tierColor(acct.tier)}>{cap(acct.tier)}</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm font-medium">{acct.points_balance.toLocaleString("en-IN")}</Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm">{acct.lifetime_points.toLocaleString("en-IN")}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm text-ui-fg-subtle">
                      {new Date(acct.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Loyalty",
  icon: Star,
})

export default LoyaltyPage
