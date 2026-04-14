# Analytics Dashboard V2 — "At-a-Glance" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the analytics admin page from a basic orders/revenue dashboard into a comprehensive pharma ecommerce command center that shows prescription pipeline health, inventory alerts, COD risk, customer lifetime value, fulfillment velocity, and compliance status — all at one glance.

**Architecture:** Add 3 new backend API endpoints (operations, inventory, prescriptions) alongside the existing 5 endpoints. Refactor the admin page into a tabbed layout: "Overview" (KPIs + sparklines), "Operations" (Rx pipeline + fulfillment + COD), "Inventory" (FEFO + expiry + stock health), "Customers" (LTV + geo + loyalty). Each tab fetches only its own data on mount. All queries use raw SQL against existing tables — no new models needed.

**Tech Stack:** Medusa v2 admin SDK (React), `@medusajs/ui` components (Container, Heading, Text, Badge, Table, Tabs, Select), raw PostgreSQL queries via `ContainerRegistrationKeys.PG_CONNECTION`, existing 36+ pharma module tables.

---

## Current State

The existing analytics page (`apps/backend/src/admin/routes/analytics/page.tsx`, 462 lines) has:
- KPI cards: orders + revenue by today/week/month/total
- Revenue trend: last 14 days mini-bar chart
- Order status distribution bar segments
- Payment methods table (Paytm/Razorpay/COD)
- Rx vs OTC split
- Product performance (top sellers, slow movers, out of stock)
- All-time top 5 products

**What's missing for an "at-a-glance" pharma command center:**
1. **Prescription pipeline** — pending Rx count, approval rate, avg review time, rejection breakdown
2. **Inventory health** — expiring-soon batches, low-stock SKUs, FEFO compliance, recall alerts
3. **COD risk** — confirmation rate, RTO rate, pending confirmations, fraud-flagged customers
4. **Fulfillment velocity** — avg time to dispatch, pending dispatch count, NDR rate, delivery success
5. **Customer insights** — new vs returning, LTV stats, loyalty tier distribution (already exists as endpoint but not shown)
6. **Compliance alerts** — pending override requests, license expiry warnings, H1 entries today

## File Structure

### New Files (API Endpoints)
| File | Responsibility |
|------|---------------|
| `apps/backend/src/api/admin/analytics/operations/route.ts` | Rx pipeline + COD + fulfillment metrics |
| `apps/backend/src/api/admin/analytics/inventory/route.ts` | Batch expiry + stock health + FEFO |

### Modified Files
| File | Changes |
|------|---------|
| `apps/backend/src/admin/routes/analytics/page.tsx` | Complete rewrite: tabbed layout with 4 tabs, new data types, new section components |
| `apps/backend/src/api/admin/analytics/route.ts` | Add prescription stats + compliance alerts to existing dashboard endpoint |

### Existing Files (Referenced, No Changes)
| File | Used For |
|------|----------|
| `apps/backend/src/api/admin/analytics/customers/route.ts` | Customer tab data (already exists) |
| `apps/backend/src/api/admin/analytics/revenue/route.ts` | Revenue trend (already exists) |
| `apps/backend/src/api/admin/analytics/products/route.ts` | Product performance (already exists) |
| `apps/backend/src/api/admin/analytics/wishlist/route.ts` | Wishlist data (already exists) |
| `apps/backend/src/api/middlewares.ts` | RBAC + rate limiting (already covers `/admin/analytics/*`) |

---

## Task 1: Add Prescription + Compliance Stats to Dashboard Endpoint

**Files:**
- Modify: `apps/backend/src/api/admin/analytics/route.ts`

This extends the existing `/admin/analytics?type=dashboard` response with prescription pipeline metrics and compliance alerts so the Overview tab can show them.

- [ ] **Step 1: Add prescription pipeline query**

Add these queries after the existing `rxOtcQuery` in `apps/backend/src/api/admin/analytics/route.ts`:

```typescript
    // ── 6. Prescription pipeline stats ─────────────────────────────
    const rxPipelineQuery = `
      SELECT
        COUNT(*) FILTER (WHERE p."status" = 'pending_review') AS pending_review,
        COUNT(*) FILTER (WHERE p."status" = 'approved') AS approved,
        COUNT(*) FILTER (WHERE p."status" = 'rejected') AS rejected,
        COUNT(*) FILTER (WHERE p."status" = 'expired') AS expired,
        COUNT(*) AS total_prescriptions,
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (p."reviewed_at" - p."created_at")) / 3600)
          FILTER (WHERE p."reviewed_at" IS NOT NULL),
          0
        ) AS avg_review_hours
      FROM "prescription" p
      WHERE p."deleted_at" IS NULL
    `

    // ── 7. Compliance alerts ───────────────────────────────────────
    const complianceQuery = `
      SELECT
        (SELECT COUNT(*) FROM "override_request"
         WHERE "status" IN ('pending_primary', 'pending_secondary')) AS pending_overrides,
        (SELECT COUNT(*) FROM "pharmacy_license"
         WHERE "is_active" = true AND "valid_until" < NOW() + INTERVAL '30 days') AS expiring_licenses,
        (SELECT COUNT(*) FROM "h1_register_entry"
         WHERE "entry_date" >= (NOW() AT TIME ZONE 'UTC' + INTERVAL ${IST_OFFSET})::date
        ) AS h1_entries_today
    `
```

- [ ] **Step 2: Add queries to Promise.all and shape response**

Update the `Promise.all` array to include the two new queries:

```typescript
    const [
      orderStatsResult,
      topProductsResult,
      statusDistResult,
      paymentSplitResult,
      rxOtcResult,
      rxPipelineResult,
      complianceResult,
    ] = await Promise.all([
      db.raw(orderStatsQuery),
      db.raw(topProductsQuery),
      db.raw(statusDistQuery),
      db.raw(paymentSplitQuery),
      db.raw(rxOtcQuery).catch(() => ({ rows: [] })),
      db.raw(rxPipelineQuery).catch(() => ({ rows: [] })),
      db.raw(complianceQuery).catch(() => ({ rows: [] })),
    ])
```

Add result shaping after `rxOtcRatio`:

```typescript
    const rxPipeline = rxPipelineResult.rows?.[0] ?? rxPipelineResult?.[0]?.[0] ?? {}
    const compliance = complianceResult.rows?.[0] ?? complianceResult?.[0]?.[0] ?? {}
```

Add these to the `res.json()` response object:

```typescript
      rx_pipeline: {
        pending_review: Number(rxPipeline.pending_review ?? 0),
        approved: Number(rxPipeline.approved ?? 0),
        rejected: Number(rxPipeline.rejected ?? 0),
        expired: Number(rxPipeline.expired ?? 0),
        total: Number(rxPipeline.total_prescriptions ?? 0),
        avg_review_hours: Number(Number(rxPipeline.avg_review_hours ?? 0).toFixed(1)),
      },
      compliance_alerts: {
        pending_overrides: Number(compliance.pending_overrides ?? 0),
        expiring_licenses: Number(compliance.expiring_licenses ?? 0),
        h1_entries_today: Number(compliance.h1_entries_today ?? 0),
      },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/api/admin/analytics/route.ts
git commit -m "feat(analytics): add prescription pipeline + compliance alerts to dashboard endpoint"
```

---

## Task 2: Create Operations Analytics Endpoint

**Files:**
- Create: `apps/backend/src/api/admin/analytics/operations/route.ts`

This endpoint returns COD metrics, fulfillment velocity, and dispatch pipeline data.

- [ ] **Step 1: Create the operations route file**

Create `apps/backend/src/api/admin/analytics/operations/route.ts`:

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/analytics/operations
 *
 * Operational metrics:
 *  - COD confirmation rate, pending count, RTO rate
 *  - Fulfillment velocity: avg dispatch time, pending dispatch, NDR rate
 *  - Dispatch pipeline: orders by pharma status
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    // ── 1. COD analytics ──────────────────────────────────────────
    const codQuery = `
      SELECT
        COUNT(*) AS total_cod_orders,
        COUNT(*) FILTER (WHERE co."status" = 'confirmed') AS confirmed,
        COUNT(*) FILTER (WHERE co."status" = 'pending_confirmation') AS pending_confirmation,
        COUNT(*) FILTER (WHERE co."status" = 'cancelled') AS cancelled,
        COUNT(*) FILTER (WHERE co."status" = 'rto') AS rto,
        CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE co."status" = 'confirmed')::numeric / COUNT(*)::numeric * 100, 1)
          ELSE 0
        END AS confirmation_rate,
        CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE co."status" = 'rto')::numeric / COUNT(*)::numeric * 100, 1)
          ELSE 0
        END AS rto_rate
      FROM "cod_order" co
    `

    // ── 2. Fulfillment velocity ───────────────────────────────────
    const fulfillmentQuery = `
      SELECT
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (s."dispatched_at" - o."created_at")) / 3600)
          FILTER (WHERE s."dispatched_at" IS NOT NULL),
          0
        ) AS avg_dispatch_hours,
        COUNT(*) FILTER (WHERE s."status" = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE s."status" = 'in_transit') AS in_transit,
        COUNT(*) FILTER (WHERE s."status" = 'out_for_delivery') AS out_for_delivery,
        COUNT(*) FILTER (WHERE s."status" = 'ndr') AS ndr,
        COUNT(*) FILTER (WHERE s."status" = 'rto_initiated' OR s."status" = 'rto_delivered') AS rto,
        COUNT(*) FILTER (WHERE s."status" = 'label_created') AS pending_dispatch,
        COUNT(*) AS total_shipments,
        CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE s."status" = 'delivered')::numeric / COUNT(*)::numeric * 100, 1)
          ELSE 0
        END AS delivery_success_rate
      FROM "shipment" s
      LEFT JOIN "order" o ON o."id" = s."order_id"
    `

    // ── 3. Pharma order pipeline (order_extension status counts) ──
    const pipelineQuery = `
      SELECT
        oe."status",
        COUNT(*)::int AS count
      FROM "order_extension" oe
      GROUP BY oe."status"
      ORDER BY count DESC
    `

    // ── 4. Pending dispatch sign-offs ─────────────────────────────
    const signoffQuery = `
      SELECT
        COUNT(*) FILTER (WHERE pdso."approved" = true) AS approved_signoffs,
        COUNT(*) FILTER (WHERE pdso."approved" = false) AS rejected_signoffs,
        COUNT(*) AS total_signoffs
      FROM "pre_dispatch_sign_off" pdso
    `

    const [codResult, fulfillmentResult, pipelineResult, signoffResult] = await Promise.all([
      db.raw(codQuery).catch(() => ({ rows: [] })),
      db.raw(fulfillmentQuery).catch(() => ({ rows: [] })),
      db.raw(pipelineQuery).catch(() => ({ rows: [] })),
      db.raw(signoffQuery).catch(() => ({ rows: [] })),
    ])

    const cod = codResult.rows?.[0] ?? codResult?.[0]?.[0] ?? {}
    const fulfillment = fulfillmentResult.rows?.[0] ?? fulfillmentResult?.[0]?.[0] ?? {}
    const signoff = signoffResult.rows?.[0] ?? signoffResult?.[0]?.[0] ?? {}

    const pipeline = Object.fromEntries(
      (pipelineResult.rows ?? pipelineResult?.[0] ?? []).map(
        (row: Record<string, unknown>) => [row.status, Number(row.count)]
      )
    )

    return res.json({
      cod: {
        total_orders: Number(cod.total_cod_orders ?? 0),
        confirmed: Number(cod.confirmed ?? 0),
        pending_confirmation: Number(cod.pending_confirmation ?? 0),
        cancelled: Number(cod.cancelled ?? 0),
        rto: Number(cod.rto ?? 0),
        confirmation_rate: Number(cod.confirmation_rate ?? 0),
        rto_rate: Number(cod.rto_rate ?? 0),
      },
      fulfillment: {
        avg_dispatch_hours: Number(Number(fulfillment.avg_dispatch_hours ?? 0).toFixed(1)),
        delivered: Number(fulfillment.delivered ?? 0),
        in_transit: Number(fulfillment.in_transit ?? 0),
        out_for_delivery: Number(fulfillment.out_for_delivery ?? 0),
        ndr: Number(fulfillment.ndr ?? 0),
        rto: Number(fulfillment.rto ?? 0),
        pending_dispatch: Number(fulfillment.pending_dispatch ?? 0),
        total_shipments: Number(fulfillment.total_shipments ?? 0),
        delivery_success_rate: Number(fulfillment.delivery_success_rate ?? 0),
      },
      pharma_pipeline: pipeline,
      dispatch_signoffs: {
        approved: Number(signoff.approved_signoffs ?? 0),
        rejected: Number(signoff.rejected_signoffs ?? 0),
        total: Number(signoff.total_signoffs ?? 0),
      },
    })
  } catch (err) {
    logger.error(`[analytics:operations] Query failed: ${(err as Error).message}`)
    return res.status(500).json({ message: "Failed to query operations analytics" })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/api/admin/analytics/operations/route.ts
git commit -m "feat(analytics): add operations endpoint (COD, fulfillment, pharma pipeline)"
```

---

## Task 3: Create Inventory Analytics Endpoint

**Files:**
- Create: `apps/backend/src/api/admin/analytics/inventory/route.ts`

- [ ] **Step 1: Create the inventory route file**

Create `apps/backend/src/api/admin/analytics/inventory/route.ts`:

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/analytics/inventory
 *
 * Inventory health:
 *  - Total SKUs, in-stock, low-stock, out-of-stock counts
 *  - Batches expiring within 30/60/90 days
 *  - Recalled batches
 *  - Recent GRN activity
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    // ── 1. Stock health summary ───────────────────────────────────
    const stockQuery = `
      WITH variant_stock AS (
        SELECT
          b."product_variant_id",
          SUM(b."available_quantity") AS total_available
        FROM "batch" b
        WHERE b."status" = 'active'
          AND b."deleted_at" IS NULL
        GROUP BY b."product_variant_id"
      )
      SELECT
        COUNT(DISTINCT pv."id") AS total_variants,
        COUNT(DISTINCT pv."id") FILTER (WHERE COALESCE(vs.total_available, 0) > 10) AS in_stock,
        COUNT(DISTINCT pv."id") FILTER (WHERE COALESCE(vs.total_available, 0) BETWEEN 1 AND 10) AS low_stock,
        COUNT(DISTINCT pv."id") FILTER (WHERE COALESCE(vs.total_available, 0) = 0) AS out_of_stock
      FROM "product_variant" pv
      JOIN "product" p ON p."id" = pv."product_id" AND p."deleted_at" IS NULL
      LEFT JOIN variant_stock vs ON vs."product_variant_id" = pv."id"
      WHERE pv."deleted_at" IS NULL
    `

    // ── 2. Batch expiry alerts ────────────────────────────────────
    const expiryQuery = `
      SELECT
        COUNT(*) FILTER (WHERE b."expiry_date" < NOW()) AS expired,
        COUNT(*) FILTER (
          WHERE b."expiry_date" >= NOW() AND b."expiry_date" < NOW() + INTERVAL '30 days'
        ) AS expiring_30d,
        COUNT(*) FILTER (
          WHERE b."expiry_date" >= NOW() + INTERVAL '30 days'
            AND b."expiry_date" < NOW() + INTERVAL '60 days'
        ) AS expiring_60d,
        COUNT(*) FILTER (
          WHERE b."expiry_date" >= NOW() + INTERVAL '60 days'
            AND b."expiry_date" < NOW() + INTERVAL '90 days'
        ) AS expiring_90d,
        COUNT(*) FILTER (WHERE b."status" = 'recalled') AS recalled,
        COUNT(*) FILTER (WHERE b."status" = 'quarantine') AS quarantine
      FROM "batch" b
      WHERE b."deleted_at" IS NULL
        AND b."available_quantity" > 0
    `

    // ── 3. Top expiring batches (soonest, active, with stock) ─────
    const topExpiringQuery = `
      SELECT
        b."id" AS batch_id,
        b."lot_number",
        b."expiry_date",
        b."available_quantity",
        p."title" AS product_title,
        dp."generic_name",
        dp."schedule"
      FROM "batch" b
      JOIN "product_variant" pv ON pv."id" = b."product_variant_id"
      JOIN "product" p ON p."id" = pv."product_id"
      LEFT JOIN "drug_product" dp ON dp."product_id" = p."id"
      WHERE b."status" = 'active'
        AND b."deleted_at" IS NULL
        AND b."available_quantity" > 0
        AND b."expiry_date" < NOW() + INTERVAL '90 days'
      ORDER BY b."expiry_date" ASC
      LIMIT 10
    `

    // ── 4. Recent GRN activity (last 30 days) ─────────────────────
    const grnQuery = `
      SELECT
        COUNT(*) AS total_grns,
        COUNT(*) FILTER (WHERE g."status" = 'approved') AS approved,
        COUNT(*) FILTER (WHERE g."status" = 'pending_qc') AS pending_qc,
        COUNT(*) FILTER (WHERE g."status" = 'rejected' OR g."status" = 'partially_rejected') AS rejected
      FROM "grn_record" g
      WHERE g."created_at" >= NOW() - INTERVAL '30 days'
    `

    const [stockResult, expiryResult, topExpiringResult, grnResult] = await Promise.all([
      db.raw(stockQuery).catch(() => ({ rows: [] })),
      db.raw(expiryQuery).catch(() => ({ rows: [] })),
      db.raw(topExpiringQuery).catch(() => ({ rows: [] })),
      db.raw(grnQuery).catch(() => ({ rows: [] })),
    ])

    const stock = stockResult.rows?.[0] ?? stockResult?.[0]?.[0] ?? {}
    const expiry = expiryResult.rows?.[0] ?? expiryResult?.[0]?.[0] ?? {}
    const grn = grnResult.rows?.[0] ?? grnResult?.[0]?.[0] ?? {}

    return res.json({
      stock_health: {
        total_variants: Number(stock.total_variants ?? 0),
        in_stock: Number(stock.in_stock ?? 0),
        low_stock: Number(stock.low_stock ?? 0),
        out_of_stock: Number(stock.out_of_stock ?? 0),
      },
      batch_alerts: {
        expired: Number(expiry.expired ?? 0),
        expiring_30d: Number(expiry.expiring_30d ?? 0),
        expiring_60d: Number(expiry.expiring_60d ?? 0),
        expiring_90d: Number(expiry.expiring_90d ?? 0),
        recalled: Number(expiry.recalled ?? 0),
        quarantine: Number(expiry.quarantine ?? 0),
      },
      top_expiring_batches: (topExpiringResult.rows ?? topExpiringResult?.[0] ?? []).map(
        (row: Record<string, unknown>) => ({
          batch_id: row.batch_id,
          lot_number: row.lot_number,
          expiry_date: row.expiry_date,
          available_quantity: Number(row.available_quantity),
          product_title: row.product_title,
          generic_name: row.generic_name,
          schedule: row.schedule,
        })
      ),
      grn_activity: {
        total: Number(grn.total_grns ?? 0),
        approved: Number(grn.approved ?? 0),
        pending_qc: Number(grn.pending_qc ?? 0),
        rejected: Number(grn.rejected ?? 0),
      },
    })
  } catch (err) {
    logger.error(`[analytics:inventory] Query failed: ${(err as Error).message}`)
    return res.status(500).json({ message: "Failed to query inventory analytics" })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/api/admin/analytics/inventory/route.ts
git commit -m "feat(analytics): add inventory endpoint (stock health, batch expiry, GRN)"
```

---

## Task 4: Rewrite Admin Analytics Page — Types + Helpers + Data Fetching

**Files:**
- Modify: `apps/backend/src/admin/routes/analytics/page.tsx`

This task replaces the entire page with a tabbed layout. We split this into two tasks: first the data layer (types, fetchers, state), then the UI components.

- [ ] **Step 1: Replace the types and imports section**

Replace the entire file `apps/backend/src/admin/routes/analytics/page.tsx` with the new implementation. Start with imports, types, and helpers:

```tsx
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
```

- [ ] **Step 2: Add the shared UI components**

Continue the file with reusable components:

```tsx
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
```

- [ ] **Step 3: Verify TypeScript compiles so far**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: No errors (file is incomplete but types should check)

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/admin/routes/analytics/page.tsx
git commit -m "feat(analytics): rewrite page types, helpers, and shared components"
```

---

## Task 5: Rewrite Admin Analytics Page — Tab Content Components

**Files:**
- Modify: `apps/backend/src/admin/routes/analytics/page.tsx`

- [ ] **Step 1: Add the Overview tab component**

Append to the file after the shared components:

```tsx
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
```

- [ ] **Step 2: Add the Operations tab component**

```tsx
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
```

- [ ] **Step 3: Add the Inventory tab component**

```tsx
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
```

- [ ] **Step 4: Add the Customers tab component**

```tsx
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
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/admin/routes/analytics/page.tsx
git commit -m "feat(analytics): add Overview, Operations, Inventory, Customers tab components"
```

---

## Task 6: Rewrite Admin Analytics Page — Main Component + Tabbed Layout

**Files:**
- Modify: `apps/backend/src/admin/routes/analytics/page.tsx`

- [ ] **Step 1: Add the main AnalyticsPage component with tabbed data fetching**

Append the main page component and export:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run backend tests to verify nothing broke**

Run: `cd apps/backend && npx jest --testMatch="**/*.unit.spec.ts" --passWithNoTests`
Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/admin/routes/analytics/page.tsx
git commit -m "feat(analytics): tabbed dashboard with lazy-loaded Operations, Inventory, Customers tabs"
```

---

## Task 7: Final Verification + Integration Test

**Files:**
- No new files — verification only

- [ ] **Step 1: Full TypeScript check**

Run: `cd apps/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run all backend unit tests**

Run: `cd apps/backend && npx jest --testMatch="**/*.unit.spec.ts"`
Expected: All 635+ tests pass

- [ ] **Step 3: Verify the analytics module tests still pass**

Run: `cd apps/backend && npx jest --testPathPattern="analytics" --verbose`
Expected: All analytics tests pass

- [ ] **Step 4: Build check**

Run: `cd apps/backend && npx medusa build 2>&1 | head -20`
Expected: Build starts without TypeScript errors (can cancel after TS phase)

- [ ] **Step 5: Final commit if any fixes needed**

If any fixes were needed during verification, commit them:

```bash
git add -A
git commit -m "fix(analytics): address verification issues"
```

---

## Summary of Changes

| What | Before | After |
|------|--------|-------|
| **KPI cards** | 8 cards (orders + revenue by period) | 8 cards + Rx pending alert + compliance strip |
| **Prescription pipeline** | Not shown | Pending/approved/rejected/expired counts + avg review time |
| **Compliance alerts** | Not shown | Override requests + license expiry + H1 entries today |
| **COD analytics** | Not shown | Confirmation rate, RTO rate, pending count |
| **Fulfillment** | Not shown | Avg dispatch time, delivery success rate, NDR count, pipeline |
| **Pharma pipeline** | Not shown | All 14 order states with counts |
| **Inventory health** | Not shown | Stock levels, batch expiry alerts (30/60/90d), recalled/quarantine |
| **Expiring batches** | Not shown | Top 10 soonest-expiring with lot#, qty, schedule |
| **GRN activity** | Not shown | Last 30 days: total, approved, pending QC, rejected |
| **Customer insights** | Separate endpoint, not shown | New vs returning, LTV distribution, top cities, top customers |
| **Page layout** | Single scroll | 4 tabs: Overview, Operations, Inventory, Customers |
| **Data loading** | All at once | Lazy: Overview loads first, other tabs on-demand |

**New API endpoints:** 2 (`/admin/analytics/operations`, `/admin/analytics/inventory`)
**Modified endpoints:** 1 (`/admin/analytics` — added rx_pipeline + compliance_alerts)
**Modified pages:** 1 (`admin/routes/analytics/page.tsx` — complete rewrite)
**All queries use existing tables** — no schema changes, no migrations.
