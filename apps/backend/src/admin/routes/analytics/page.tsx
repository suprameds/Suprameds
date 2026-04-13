import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Table, Badge, Select, Tabs } from "@medusajs/ui"
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
  rx_pipeline: {
    pending_review: number; approved: number; rejected: number
    expired: number; total: number; avg_review_hours: number
  }
  compliance_alerts: {
    pending_overrides: number; expiring_licenses: number; h1_entries_today: number
  }
}

type RevenueDataPoint = {
  period: string; order_count: number; revenue: number; avg_order_value: number
}

type RevenueData = {
  totals: { order_count: number; revenue: number; avg_order_value: number }
  data: RevenueDataPoint[]
}

type ProductData = {
  products: Array<{
    id: string; title: string; units_sold: number; revenue: number
    generic_name: string | null; schedule: string | null
    daily_velocity?: number; total_stock?: number; last_sold_at?: string
  }>
}

type OperationsData = {
  cod: {
    total_orders: number; confirmed: number; pending_confirmation: number
    cancelled: number; rto: number; confirmation_rate: number; rto_rate: number
  }
  fulfillment: {
    avg_dispatch_hours: number; delivered: number; in_transit: number
    out_for_delivery: number; ndr: number; rto: number
    pending_dispatch: number; total_shipments: number; delivery_success_rate: number
  }
  pharma_pipeline: Record<string, number>
  dispatch_signoffs: { approved: number; rejected: number; total: number }
}

type InventoryData = {
  stock_health: {
    total_variants: number; in_stock: number; low_stock: number; out_of_stock: number
  }
  batch_alerts: {
    expired: number; expiring_30d: number; expiring_60d: number
    expiring_90d: number; recalled: number; quarantine: number
  }
  top_expiring_batches: Array<{
    batch_id: string; lot_number: string; expiry_date: string
    available_quantity: number; product_title: string
    generic_name: string | null; schedule: string | null
  }>
  grn_activity: { total: number; approved: number; pending_qc: number; rejected: number }
}

type CustomerData = {
  new_vs_returning: {
    new_customers: number; returning_customers: number; total_active: number
  }
  lifetime_value: {
    total_customers: number; avg_ltv: number; median_ltv: number
    p90_ltv: number; max_ltv: number; avg_orders_per_customer: number
    single_order_customers: number; repeat_customers: number; loyal_customers: number
  }
  geographic_distribution: Array<{
    city: string; state: string; order_count: number
    customer_count: number; revenue: number
  }>
  top_customers: Array<{
    customer_id: string; name: string; email: string; phone: string
    total_orders: number; lifetime_value: number
  }>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const inr = (amount: number) =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

const dateStr = (d: Date) => d.toISOString().split("T")[0]

const today = new Date()
const thirtyDaysAgo = new Date(today)
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

const pct = (part: number, total: number) =>
  total > 0 ? `${Math.round((part / total) * 100)}%` : "0%"

// ── Shared Components ───────────────────────────────────────────────────────

const StatCard = ({
  label, value, sub, alert,
}: {
  label: string; value: string | number; sub?: string; alert?: boolean
}) => (
  <div className={`p-4 rounded-lg border ${alert ? "border-red-300 bg-red-50" : "border-ui-border-base bg-ui-bg-base"}`}>
    <Text className="text-xs text-ui-fg-subtle uppercase tracking-wide">{label}</Text>
    <Text className={`text-2xl font-semibold mt-1 ${alert ? "text-red-600" : ""}`}>{value}</Text>
    {sub && <Text className="text-xs text-ui-fg-muted mt-0.5">{sub}</Text>}
  </div>
)

const AlertCard = ({
  label, value, color,
}: {
  label: string; value: number; color: "red" | "orange" | "green" | "blue" | "grey"
}) => (
  <div className="flex items-center justify-between p-3 rounded-lg border border-ui-border-base">
    <Text className="text-sm">{label}</Text>
    <Badge color={color}>{value}</Badge>
  </div>
)

const MiniBar = ({ value, maxValue }: { value: number; maxValue: number }) => {
  const p = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0
  return (
    <div className="w-full bg-ui-bg-subtle rounded h-4 overflow-hidden">
      <div className="h-full rounded bg-blue-500" style={{ width: `${Math.max(p, 2)}%` }} />
    </div>
  )
}

const BarSegment = ({
  label, value, total, color,
}: {
  label: string; value: number; total: number; color: string
}) => {
  const p = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <Text className="text-sm w-36 text-right truncate">{label}</Text>
      <div className="flex-1 bg-ui-bg-subtle rounded-full h-5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${p}%` }} />
      </div>
      <Text className="text-sm w-20 text-right">{value} ({p}%)</Text>
    </div>
  )
}

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <Heading level="h2" className="mb-4">{children}</Heading>
)

// ── Tab: Overview ───────────────────────────────────────────────────────────

const OverviewTab = ({
  dashboard, revenue, products, productView, setProductView,
}: {
  dashboard: DashboardData; revenue: RevenueData | null
  products: ProductData | null; productView: string
  setProductView: (v: string) => void
}) => {
  const totalStatusOrders = Object.values(dashboard.status_distribution).reduce((a, b) => a + b, 0)
  const maxRevDay = revenue ? Math.max(...revenue.data.map((d) => d.revenue), 1) : 1

  const statusColors: Record<string, string> = {
    pending: "bg-amber-400", processing: "bg-blue-400", shipped: "bg-indigo-400",
    completed: "bg-green-500", delivered: "bg-green-500",
    canceled: "bg-red-400", cancelled: "bg-red-400", requires_action: "bg-orange-400",
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Orders Today" value={dashboard.orders.today} />
        <StatCard label="Revenue Today" value={inr(dashboard.revenue.today)} />
        <StatCard label="Orders This Month" value={dashboard.orders.this_month} />
        <StatCard label="Revenue This Month" value={inr(dashboard.revenue.this_month)} />
        <StatCard label="Total Orders" value={dashboard.orders.total.toLocaleString("en-IN")} />
        <StatCard label="Total Revenue" value={inr(dashboard.revenue.total)} />
        <StatCard label="Avg Order Value" value={inr(Math.round(dashboard.avg_order_value))} />
        <StatCard
          label="Rx Pending Review"
          value={dashboard.rx_pipeline.pending_review}
          alert={dashboard.rx_pipeline.pending_review > 0}
          sub={`${dashboard.rx_pipeline.avg_review_hours}h avg review`}
        />
      </div>

      {/* Compliance Alert Strip */}
      {(dashboard.compliance_alerts.pending_overrides > 0 ||
        dashboard.compliance_alerts.expiring_licenses > 0) && (
        <Container className="p-4 bg-amber-50 border-amber-200">
          <div className="flex gap-6">
            {dashboard.compliance_alerts.pending_overrides > 0 && (
              <Text className="text-sm text-amber-800">
                <strong>{dashboard.compliance_alerts.pending_overrides}</strong> pending override requests
              </Text>
            )}
            {dashboard.compliance_alerts.expiring_licenses > 0 && (
              <Text className="text-sm text-amber-800">
                <strong>{dashboard.compliance_alerts.expiring_licenses}</strong> licenses expiring within 30 days
              </Text>
            )}
            <Text className="text-sm text-ui-fg-subtle">
              H1 entries today: <strong>{dashboard.compliance_alerts.h1_entries_today}</strong>
            </Text>
          </div>
        </Container>
      )}

      {/* Rx Pipeline Summary */}
      <Container className="p-6">
        <SectionHeader>Prescription Pipeline</SectionHeader>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <AlertCard label="Pending Review" value={dashboard.rx_pipeline.pending_review} color="orange" />
          <AlertCard label="Approved" value={dashboard.rx_pipeline.approved} color="green" />
          <AlertCard label="Rejected" value={dashboard.rx_pipeline.rejected} color="red" />
          <AlertCard label="Expired" value={dashboard.rx_pipeline.expired} color="grey" />
          <AlertCard label="Total" value={dashboard.rx_pipeline.total} color="blue" />
        </div>
      </Container>

      {/* Revenue Trend */}
      {revenue && revenue.data.length > 0 && (
        <Container className="p-6">
          <SectionHeader>Revenue Trend (Last 30 Days)</SectionHeader>
          <div className="space-y-1">
            {revenue.data.slice(-14).map((d) => (
              <div key={d.period} className="flex items-center gap-3">
                <Text className="text-xs text-ui-fg-subtle w-20 shrink-0">
                  {new Date(d.period).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </Text>
                <div className="flex-1"><MiniBar value={d.revenue} maxValue={maxRevDay} /></div>
                <Text className="text-xs w-20 text-right">{inr(d.revenue)}</Text>
                <Text className="text-xs text-ui-fg-muted w-12 text-right">{d.order_count} ord</Text>
              </div>
            ))}
          </div>
          {revenue.totals && (
            <div className="mt-4 pt-3 border-t border-ui-border-base flex gap-6">
              <Text className="text-sm">
                <span className="text-ui-fg-subtle">Period Total:</span> <strong>{inr(revenue.totals.revenue)}</strong>
              </Text>
              <Text className="text-sm">
                <span className="text-ui-fg-subtle">Orders:</span> <strong>{revenue.totals.order_count}</strong>
              </Text>
              <Text className="text-sm">
                <span className="text-ui-fg-subtle">AOV:</span> <strong>{inr(revenue.totals.avg_order_value)}</strong>
              </Text>
            </div>
          )}
        </Container>
      )}

      {/* Status + Payment side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Container className="p-6">
          <SectionHeader>Order Status Distribution</SectionHeader>
          <div className="space-y-2">
            {Object.entries(dashboard.status_distribution).map(([status, count]) => (
              <BarSegment
                key={status} label={status.replace(/_/g, " ")}
                value={count} total={totalStatusOrders}
                color={statusColors[status] ?? "bg-ui-fg-subtle"}
              />
            ))}
          </div>
        </Container>

        <Container className="p-6">
          <SectionHeader>Payment Methods</SectionHeader>
          {dashboard.payment_methods.length === 0 ? (
            <Text className="text-ui-fg-subtle">No payment data.</Text>
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
        </Container>
      </div>

      {/* Product Performance */}
      <Container className="divide-y p-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <Heading level="h2">Product Performance</Heading>
          <Select value={productView} onValueChange={(val) => setProductView(val)}>
            <Select.Trigger><Select.Value placeholder="View" /></Select.Trigger>
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
                {productView === "slow_movers" && <Table.HeaderCell className="text-right">Velocity</Table.HeaderCell>}
                {productView === "out_of_stock" && <Table.HeaderCell className="text-right">Stock</Table.HeaderCell>}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {products.products.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell>
                    <div>
                      <Text className="text-sm font-medium">{p.title}</Text>
                      {p.generic_name && <Text className="text-xs text-ui-fg-muted">{p.generic_name}</Text>}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={p.schedule === "X" ? "red" : p.schedule === "H" || p.schedule === "H1" ? "orange" : "green"}>
                      {p.schedule || "OTC"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">{p.units_sold.toLocaleString("en-IN")}</Table.Cell>
                  <Table.Cell className="text-right">{inr(p.revenue)}</Table.Cell>
                  {productView === "slow_movers" && (
                    <Table.Cell className="text-right">{p.daily_velocity ?? 0}/day</Table.Cell>
                  )}
                  {productView === "out_of_stock" && (
                    <Table.Cell className="text-right"><Badge color="red">{p.total_stock ?? 0}</Badge></Table.Cell>
                  )}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>
    </div>
  )
}

// ── Tab: Operations ─────────────────────────────────────────────────────────

const OperationsTab = ({ data }: { data: OperationsData | null }) => {
  if (!data) return <Text className="text-ui-fg-subtle p-4">Loading operations data...</Text>

  const totalPipeline = Object.values(data.pharma_pipeline).reduce((a, b) => a + b, 0)

  const pipelineColors: Record<string, string> = {
    pending_rx_review: "bg-purple-400", pending_cod_confirmation: "bg-amber-400",
    fully_approved: "bg-green-400", allocation_pending: "bg-blue-300",
    pick_pending: "bg-blue-400", packing: "bg-indigo-400",
    pending_dispatch_approval: "bg-orange-400", dispatched: "bg-cyan-400",
    delivered: "bg-green-600", cancelled: "bg-red-400", refunded: "bg-red-300",
  }

  return (
    <div className="flex flex-col gap-4">
      {/* COD + Fulfillment KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="COD Confirmation Rate" value={`${data.cod.confirmation_rate}%`}
          sub={`${data.cod.pending_confirmation} pending`}
          alert={data.cod.pending_confirmation > 5} />
        <StatCard label="COD RTO Rate" value={`${data.cod.rto_rate}%`}
          sub={`${data.cod.rto} returns`}
          alert={data.cod.rto_rate > 10} />
        <StatCard label="Avg Dispatch Time" value={`${data.fulfillment.avg_dispatch_hours}h`}
          alert={data.fulfillment.avg_dispatch_hours > 48} />
        <StatCard label="Delivery Success" value={`${data.fulfillment.delivery_success_rate}%`}
          sub={`${data.fulfillment.delivered} delivered`} />
      </div>

      {/* Fulfillment Pipeline */}
      <Container className="p-6">
        <SectionHeader>Fulfillment Pipeline</SectionHeader>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AlertCard label="Pending Dispatch" value={data.fulfillment.pending_dispatch} color={data.fulfillment.pending_dispatch > 10 ? "orange" : "blue"} />
          <AlertCard label="In Transit" value={data.fulfillment.in_transit} color="blue" />
          <AlertCard label="Out for Delivery" value={data.fulfillment.out_for_delivery} color="green" />
          <AlertCard label="NDR (Non-Delivery)" value={data.fulfillment.ndr} color={data.fulfillment.ndr > 0 ? "red" : "grey"} />
        </div>
      </Container>

      {/* COD Breakdown */}
      <Container className="p-6">
        <SectionHeader>COD Orders Breakdown</SectionHeader>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <AlertCard label="Total COD" value={data.cod.total_orders} color="blue" />
          <AlertCard label="Confirmed" value={data.cod.confirmed} color="green" />
          <AlertCard label="Pending" value={data.cod.pending_confirmation} color="orange" />
          <AlertCard label="Cancelled" value={data.cod.cancelled} color="grey" />
          <AlertCard label="RTO" value={data.cod.rto} color="red" />
        </div>
      </Container>

      {/* Pharma Order Pipeline */}
      <Container className="p-6">
        <SectionHeader>Pharma Order Pipeline (14-State)</SectionHeader>
        <div className="space-y-2">
          {Object.entries(data.pharma_pipeline).map(([status, count]) => (
            <BarSegment
              key={status} label={status.replace(/_/g, " ")}
              value={count} total={totalPipeline}
              color={pipelineColors[status] ?? "bg-ui-fg-subtle"}
            />
          ))}
        </div>
      </Container>

      {/* Dispatch Sign-offs */}
      <Container className="p-6">
        <SectionHeader>Pre-Dispatch Sign-offs</SectionHeader>
        <div className="grid grid-cols-3 gap-3">
          <AlertCard label="Approved" value={data.dispatch_signoffs.approved} color="green" />
          <AlertCard label="Rejected" value={data.dispatch_signoffs.rejected} color="red" />
          <AlertCard label="Total" value={data.dispatch_signoffs.total} color="blue" />
        </div>
      </Container>
    </div>
  )
}

// ── Tab: Inventory ──────────────────────────────────────────────────────────

const InventoryTab = ({ data }: { data: InventoryData | null }) => {
  if (!data) return <Text className="text-ui-fg-subtle p-4">Loading inventory data...</Text>

  return (
    <div className="flex flex-col gap-4">
      {/* Stock Health */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total SKUs" value={data.stock_health.total_variants} />
        <StatCard label="In Stock" value={data.stock_health.in_stock} sub={pct(data.stock_health.in_stock, data.stock_health.total_variants)} />
        <StatCard label="Low Stock (1-10)" value={data.stock_health.low_stock}
          alert={data.stock_health.low_stock > 0}
          sub={pct(data.stock_health.low_stock, data.stock_health.total_variants)} />
        <StatCard label="Out of Stock" value={data.stock_health.out_of_stock}
          alert={data.stock_health.out_of_stock > 0}
          sub={pct(data.stock_health.out_of_stock, data.stock_health.total_variants)} />
      </div>

      {/* Batch Alerts */}
      <Container className="p-6">
        <SectionHeader>Batch Expiry Alerts</SectionHeader>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <AlertCard label="Already Expired" value={data.batch_alerts.expired} color={data.batch_alerts.expired > 0 ? "red" : "grey"} />
          <AlertCard label="Expiring in 30 days" value={data.batch_alerts.expiring_30d} color={data.batch_alerts.expiring_30d > 0 ? "red" : "grey"} />
          <AlertCard label="Expiring 30-60 days" value={data.batch_alerts.expiring_60d} color={data.batch_alerts.expiring_60d > 0 ? "orange" : "grey"} />
          <AlertCard label="Expiring 60-90 days" value={data.batch_alerts.expiring_90d} color="blue" />
          <AlertCard label="Recalled Batches" value={data.batch_alerts.recalled} color={data.batch_alerts.recalled > 0 ? "red" : "grey"} />
          <AlertCard label="In Quarantine" value={data.batch_alerts.quarantine} color={data.batch_alerts.quarantine > 0 ? "orange" : "grey"} />
        </div>
      </Container>

      {/* Top Expiring Batches */}
      {data.top_expiring_batches.length > 0 && (
        <Container className="divide-y p-0">
          <div className="px-6 py-4"><Heading level="h2">Soonest Expiring Batches (with stock)</Heading></div>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Product</Table.HeaderCell>
                <Table.HeaderCell>Lot #</Table.HeaderCell>
                <Table.HeaderCell>Schedule</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Qty</Table.HeaderCell>
                <Table.HeaderCell>Expiry</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.top_expiring_batches.map((b) => (
                <Table.Row key={b.batch_id}>
                  <Table.Cell>
                    <div>
                      <Text className="text-sm font-medium">{b.product_title}</Text>
                      {b.generic_name && <Text className="text-xs text-ui-fg-muted">{b.generic_name}</Text>}
                    </div>
                  </Table.Cell>
                  <Table.Cell><Text className="text-sm">{b.lot_number}</Text></Table.Cell>
                  <Table.Cell>
                    <Badge color={b.schedule === "H" || b.schedule === "H1" ? "orange" : "green"}>
                      {b.schedule || "OTC"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">{b.available_quantity}</Table.Cell>
                  <Table.Cell>
                    <Badge color={new Date(b.expiry_date) < new Date() ? "red" : "orange"}>
                      {new Date(b.expiry_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Container>
      )}

      {/* GRN Activity */}
      <Container className="p-6">
        <SectionHeader>GRN Activity (Last 30 Days)</SectionHeader>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AlertCard label="Total GRNs" value={data.grn_activity.total} color="blue" />
          <AlertCard label="QC Approved" value={data.grn_activity.approved} color="green" />
          <AlertCard label="Pending QC" value={data.grn_activity.pending_qc} color={data.grn_activity.pending_qc > 0 ? "orange" : "grey"} />
          <AlertCard label="Rejected" value={data.grn_activity.rejected} color={data.grn_activity.rejected > 0 ? "red" : "grey"} />
        </div>
      </Container>
    </div>
  )
}

// ── Tab: Customers ──────────────────────────────────────────────────────────

const CustomersTab = ({ data }: { data: CustomerData | null }) => {
  if (!data) return <Text className="text-ui-fg-subtle p-4">Loading customer data...</Text>

  return (
    <div className="flex flex-col gap-4">
      {/* Customer KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Customers" value={data.lifetime_value.total_customers} />
        <StatCard label="New Customers" value={data.new_vs_returning.new_customers}
          sub={pct(data.new_vs_returning.new_customers, data.new_vs_returning.total_active)} />
        <StatCard label="Returning" value={data.new_vs_returning.returning_customers}
          sub={pct(data.new_vs_returning.returning_customers, data.new_vs_returning.total_active)} />
        <StatCard label="Avg Orders/Customer" value={data.lifetime_value.avg_orders_per_customer} />
      </div>

      {/* LTV Stats */}
      <Container className="p-6">
        <SectionHeader>Lifetime Value Distribution</SectionHeader>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Avg LTV" value={inr(data.lifetime_value.avg_ltv)} />
          <StatCard label="Median LTV" value={inr(data.lifetime_value.median_ltv)} />
          <StatCard label="P90 LTV" value={inr(data.lifetime_value.p90_ltv)} />
          <StatCard label="Max LTV" value={inr(data.lifetime_value.max_ltv)} />
          <StatCard label="Loyal (5+ orders)" value={data.lifetime_value.loyal_customers}
            sub={`${data.lifetime_value.repeat_customers} repeat, ${data.lifetime_value.single_order_customers} one-time`} />
        </div>
      </Container>

      {/* Top Cities */}
      {data.geographic_distribution.length > 0 && (
        <Container className="divide-y p-0">
          <div className="px-6 py-4"><Heading level="h2">Top Cities</Heading></div>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>City</Table.HeaderCell>
                <Table.HeaderCell>State</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Orders</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Customers</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Revenue</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.geographic_distribution.slice(0, 10).map((geo) => (
                <Table.Row key={`${geo.city}-${geo.state}`}>
                  <Table.Cell><Text className="text-sm font-medium">{geo.city}</Text></Table.Cell>
                  <Table.Cell><Text className="text-sm text-ui-fg-muted">{geo.state}</Text></Table.Cell>
                  <Table.Cell className="text-right">{geo.order_count}</Table.Cell>
                  <Table.Cell className="text-right">{geo.customer_count}</Table.Cell>
                  <Table.Cell className="text-right">{inr(geo.revenue)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Container>
      )}

      {/* Top Customers */}
      {data.top_customers.length > 0 && (
        <Container className="divide-y p-0">
          <div className="px-6 py-4"><Heading level="h2">Top Customers by LTV</Heading></div>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Customer</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Orders</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Lifetime Value</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.top_customers.map((c) => (
                <Table.Row key={c.customer_id}>
                  <Table.Cell>
                    <div>
                      <Text className="text-sm font-medium">{c.name}</Text>
                      <Text className="text-xs text-ui-fg-muted">{c.email || c.phone}</Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-right">{c.total_orders}</Table.Cell>
                  <Table.Cell className="text-right">{inr(c.lifetime_value)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Container>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

const AnalyticsPage = () => {
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productView, setProductView] = useState("top_sellers")

  // Data state
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [revenue, setRevenue] = useState<RevenueData | null>(null)
  const [products, setProducts] = useState<ProductData | null>(null)
  const [operations, setOperations] = useState<OperationsData | null>(null)
  const [inventory, setInventory] = useState<InventoryData | null>(null)
  const [customers, setCustomers] = useState<CustomerData | null>(null)

  // Fetch overview data (always loaded first)
  const fetchOverview = useCallback(async () => {
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
      console.error("[analytics]", err)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [productView])

  // Lazy-fetch tab data only when tab becomes active
  const fetchTabData = useCallback(async (tab: string) => {
    try {
      if (tab === "operations" && !operations) {
        const data = await sdk.client.fetch<OperationsData>("/admin/analytics/operations")
        setOperations(data)
      } else if (tab === "inventory" && !inventory) {
        const data = await sdk.client.fetch<InventoryData>("/admin/analytics/inventory")
        setInventory(data)
      } else if (tab === "customers" && !customers) {
        const data = await sdk.client.fetch<CustomerData>(
          `/admin/analytics/customers?from=${dateStr(thirtyDaysAgo)}&to=${dateStr(today)}`
        )
        setCustomers(data)
      }
    } catch (err) {
      console.error(`[analytics:${tab}]`, err)
    }
  }, [operations, inventory, customers])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  useEffect(() => {
    if (activeTab !== "overview") {
      fetchTabData(activeTab)
    }
  }, [activeTab, fetchTabData])

  if (loading) {
    return (
      <Container className="p-6">
        <Heading level="h1" className="mb-4">Analytics Dashboard</Heading>
        <Text className="text-ui-fg-subtle">Loading analytics...</Text>
      </Container>
    )
  }

  if (error || !dashboard) {
    return (
      <Container className="p-6">
        <Heading level="h1" className="mb-4">Analytics Dashboard</Heading>
        <Text className="text-ui-fg-subtle">{error ?? "Unable to load analytics data."}</Text>
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="p-6 pb-0">
        <Heading level="h1" className="mb-4">Analytics Dashboard</Heading>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
            <Tabs.Trigger value="operations">Operations</Tabs.Trigger>
            <Tabs.Trigger value="inventory">Inventory</Tabs.Trigger>
            <Tabs.Trigger value="customers">Customers</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      </Container>

      {activeTab === "overview" && (
        <OverviewTab
          dashboard={dashboard} revenue={revenue}
          products={products} productView={productView}
          setProductView={setProductView}
        />
      )}
      {activeTab === "operations" && <OperationsTab data={operations} />}
      {activeTab === "inventory" && <InventoryTab data={inventory} />}
      {activeTab === "customers" && <CustomersTab data={customers} />}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Analytics",
  icon: ChartBar,
})

export default AnalyticsPage
