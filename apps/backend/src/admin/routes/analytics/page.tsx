import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Table, Badge, Select } from "@medusajs/ui"
import { ChartBar } from "@medusajs/icons"
import { useEffect, useState, useCallback } from "react"
import { sdk } from "../../lib/client"

// ── Types ────────────────────────────────────────────────────────────────────

type DashboardData = {
  orders: { today: number; this_week: number; this_month: number; total: number }
  revenue: {
    today: number; this_week: number; this_month: number; total: number
    currency_code: string
  }
  avg_order_value: number
  top_products: Array<{
    id: string; title: string; thumbnail: string | null
    units_sold: number; revenue: number
  }>
  status_distribution: Record<string, number>
  payment_methods: Array<{ method: string; order_count: number; revenue: number }>
  rx_otc_ratio: Record<string, number>
}

type RevenueDataPoint = {
  period: string
  order_count: number
  revenue: number
  avg_order_value: number
}

type RevenueData = {
  totals: { order_count: number; revenue: number; avg_order_value: number }
  data: RevenueDataPoint[]
}

type ProductData = {
  products: Array<{
    id: string; title: string; units_sold: number; revenue: number
    generic_name: string | null; schedule: string | null; daily_velocity?: number
    total_stock?: number; last_sold_at?: string
  }>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const inr = (amount: number) =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

const dateStr = (d: Date) => d.toISOString().split("T")[0]

const today = new Date()
const thirtyDaysAgo = new Date(today)
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

// ── Components ───────────────────────────────────────────────────────────────

const StatCard = ({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) => (
  <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-base">
    <Text className="text-xs text-ui-fg-subtle uppercase tracking-wide">{label}</Text>
    <Text className="text-2xl font-semibold mt-1">{value}</Text>
    {sub && <Text className="text-xs text-ui-fg-muted mt-0.5">{sub}</Text>}
  </div>
)

const BarSegment = ({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <Text className="text-sm w-28 text-right truncate">{label}</Text>
      <div className="flex-1 bg-ui-bg-subtle rounded-full h-5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <Text className="text-sm w-20 text-right">
        {value} ({pct}%)
      </Text>
    </div>
  )
}

// Minimal sparkline-style bars for revenue trend
const MiniBar = ({
  value,
  maxValue,
}: {
  value: number
  maxValue: number
}) => {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0
  return (
    <div className="w-full bg-ui-bg-subtle rounded h-4 overflow-hidden">
      <div
        className="h-full rounded bg-blue-500"
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

const AnalyticsPage = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [revenue, setRevenue] = useState<RevenueData | null>(null)
  const [products, setProducts] = useState<ProductData | null>(null)
  const [productView, setProductView] = useState("top_sellers")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashData, revData, prodData] = await Promise.all([
        sdk.client.fetch<DashboardData>("/admin/analytics?type=dashboard"),
        sdk.client.fetch<RevenueData>(
          `/admin/analytics/revenue?from=${dateStr(thirtyDaysAgo)}&to=${dateStr(today)}&granularity=day`
        ),
        sdk.client.fetch<ProductData>(
          `/admin/analytics/products?view=${productView}&limit=20`
        ),
      ])

      setDashboard(dashData)
      setRevenue(revData)
      setProducts(prodData)
    } catch (err) {
      console.error("[analytics-admin]", err)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [productView])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  if (loading) {
    return (
      <Container>
        <Heading level="h1" className="mb-4">Analytics Dashboard</Heading>
        <Text className="text-ui-fg-subtle">Loading analytics...</Text>
      </Container>
    )
  }

  if (error || !dashboard) {
    return (
      <Container>
        <Heading level="h1" className="mb-4">Analytics Dashboard</Heading>
        <Text className="text-ui-fg-subtle">
          {error ?? "Unable to load analytics data."}
        </Text>
      </Container>
    )
  }

  const statusColors: Record<string, string> = {
    pending: "bg-amber-400",
    processing: "bg-blue-400",
    shipped: "bg-indigo-400",
    completed: "bg-green-500",
    delivered: "bg-green-500",
    canceled: "bg-red-400",
    cancelled: "bg-red-400",
    requires_action: "bg-orange-400",
  }

  const totalStatusOrders = Object.values(dashboard.status_distribution).reduce(
    (a, b) => a + b,
    0
  )

  const totalRxOtc = Object.values(dashboard.rx_otc_ratio).reduce((a, b) => a + b, 0)

  const maxRevDay = revenue
    ? Math.max(...revenue.data.map((d) => d.revenue), 1)
    : 1

  return (
    <div className="flex flex-col gap-4">
      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <Container className="p-6">
        <Heading level="h1" className="mb-6">Analytics Dashboard</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Orders Today" value={dashboard.orders.today} />
          <StatCard label="Orders This Week" value={dashboard.orders.this_week} />
          <StatCard label="Orders This Month" value={dashboard.orders.this_month} />
          <StatCard label="Total Orders" value={dashboard.orders.total.toLocaleString("en-IN")} />
          <StatCard label="Revenue Today" value={inr(dashboard.revenue.today)} />
          <StatCard label="Revenue This Week" value={inr(dashboard.revenue.this_week)} />
          <StatCard label="Revenue This Month" value={inr(dashboard.revenue.this_month)} />
          <StatCard
            label="Avg Order Value"
            value={inr(Math.round(dashboard.avg_order_value))}
          />
        </div>
      </Container>

      {/* ── Revenue Trend (last 30 days) ──────────────────────────── */}
      {revenue && revenue.data.length > 0 && (
        <Container className="p-6">
          <Heading level="h2" className="mb-4">Revenue Trend (Last 30 Days)</Heading>
          <div className="space-y-1">
            {revenue.data.slice(-14).map((d) => (
              <div key={d.period} className="flex items-center gap-3">
                <Text className="text-xs text-ui-fg-subtle w-20 shrink-0">
                  {new Date(d.period).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </Text>
                <div className="flex-1">
                  <MiniBar value={d.revenue} maxValue={maxRevDay} />
                </div>
                <Text className="text-xs w-20 text-right">{inr(d.revenue)}</Text>
                <Text className="text-xs text-ui-fg-muted w-12 text-right">
                  {d.order_count} ord
                </Text>
              </div>
            ))}
          </div>
          {revenue.totals && (
            <div className="mt-4 pt-3 border-t border-ui-border-base flex gap-6">
              <Text className="text-sm">
                <span className="text-ui-fg-subtle">Period Total:</span>{" "}
                <strong>{inr(revenue.totals.revenue)}</strong>
              </Text>
              <Text className="text-sm">
                <span className="text-ui-fg-subtle">Orders:</span>{" "}
                <strong>{revenue.totals.order_count}</strong>
              </Text>
              <Text className="text-sm">
                <span className="text-ui-fg-subtle">AOV:</span>{" "}
                <strong>{inr(revenue.totals.avg_order_value)}</strong>
              </Text>
            </div>
          )}
        </Container>
      )}

      {/* ── Status Distribution + Payment Split ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Container className="p-6">
          <Heading level="h2" className="mb-4">Order Status Distribution</Heading>
          <div className="space-y-2">
            {Object.entries(dashboard.status_distribution).map(([status, count]) => (
              <BarSegment
                key={status}
                label={status.replace(/_/g, " ")}
                value={count}
                total={totalStatusOrders}
                color={statusColors[status] ?? "bg-ui-fg-subtle"}
              />
            ))}
          </div>
        </Container>

        <Container className="p-6">
          <Heading level="h2" className="mb-4">Payment Methods</Heading>
          {dashboard.payment_methods.length === 0 ? (
            <Text className="text-ui-fg-subtle">No payment data available.</Text>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Method</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Orders</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Revenue</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {dashboard.payment_methods.map((pm) => (
                  <Table.Row key={pm.method}>
                    <Table.Cell>
                      <Badge color={pm.method === "paytm" || pm.method === "razorpay" ? "blue" : "grey"}>
                        {pm.method.toUpperCase()}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-right">{pm.order_count}</Table.Cell>
                    <Table.Cell className="text-right">{inr(pm.revenue)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}

          {/* Rx vs OTC */}
          {totalRxOtc > 0 && (
            <div className="mt-6 pt-4 border-t border-ui-border-base">
              <Text className="text-sm font-semibold mb-2">Prescription vs OTC</Text>
              <div className="space-y-2">
                <BarSegment
                  label="Prescription"
                  value={dashboard.rx_otc_ratio.prescription ?? 0}
                  total={totalRxOtc}
                  color="bg-purple-500"
                />
                <BarSegment
                  label="OTC"
                  value={dashboard.rx_otc_ratio.otc ?? 0}
                  total={totalRxOtc}
                  color="bg-green-500"
                />
              </div>
            </div>
          )}
        </Container>
      </div>

      {/* ── Top Products ──────────────────────────────────────────── */}
      <Container className="divide-y p-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <Heading level="h2">Product Performance</Heading>
          <Select
            value={productView}
            onValueChange={(val) => setProductView(val)}
          >
            <Select.Trigger>
              <Select.Value placeholder="View" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="top_sellers">Top Sellers</Select.Item>
              <Select.Item value="slow_movers">Slow Movers</Select.Item>
              <Select.Item value="out_of_stock">Out of Stock</Select.Item>
            </Select.Content>
          </Select>
        </div>

        {!products || products.products.length === 0 ? (
          <div className="flex justify-center p-6">
            <Text className="text-ui-fg-subtle">No product data available.</Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Product</Table.HeaderCell>
                <Table.HeaderCell>Schedule</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Units Sold</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Revenue</Table.HeaderCell>
                {productView === "slow_movers" && (
                  <Table.HeaderCell className="text-right">Daily Velocity</Table.HeaderCell>
                )}
                {productView === "out_of_stock" && (
                  <Table.HeaderCell className="text-right">Stock</Table.HeaderCell>
                )}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {products.products.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell>
                    <div>
                      <Text className="text-sm font-medium">{p.title}</Text>
                      {p.generic_name && (
                        <Text className="text-xs text-ui-fg-muted">{p.generic_name}</Text>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {p.schedule ? (
                      <Badge
                        color={
                          p.schedule === "X"
                            ? "red"
                            : p.schedule === "H" || p.schedule === "H1"
                            ? "orange"
                            : "green"
                        }
                      >
                        {p.schedule}
                      </Badge>
                    ) : (
                      <Badge color="green">OTC</Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {p.units_sold.toLocaleString("en-IN")}
                  </Table.Cell>
                  <Table.Cell className="text-right">{inr(p.revenue)}</Table.Cell>
                  {productView === "slow_movers" && (
                    <Table.Cell className="text-right">
                      <Text className="text-sm">{p.daily_velocity ?? 0}/day</Text>
                    </Table.Cell>
                  )}
                  {productView === "out_of_stock" && (
                    <Table.Cell className="text-right">
                      <Badge color="red">{p.total_stock ?? 0}</Badge>
                    </Table.Cell>
                  )}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>

      {/* ── Top 5 from Dashboard ──────────────────────────────────── */}
      {dashboard.top_products.length > 0 && (
        <Container className="divide-y p-0">
          <div className="px-6 py-4">
            <Heading level="h2">All-Time Top 5 Products</Heading>
          </div>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>#</Table.HeaderCell>
                <Table.HeaderCell>Product</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Units</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Revenue</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {dashboard.top_products.map((p, i) => (
                <Table.Row key={p.id}>
                  <Table.Cell>
                    <Badge color="grey">{i + 1}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm font-medium">{p.title}</Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {p.units_sold.toLocaleString("en-IN")}
                  </Table.Cell>
                  <Table.Cell className="text-right">{inr(p.revenue)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Container>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Analytics",
  icon: ChartBar,
})

export default AnalyticsPage
