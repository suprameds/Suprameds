import { AccountListSkeleton } from "@/components/ui/skeletons"
import { createFileRoute, Link, useLocation } from "@tanstack/react-router"
import { useState } from "react"
import { useCustomerOrders } from "@/lib/hooks/use-orders"
import { deriveOrderProgress } from "@/components/order"
import { ReturnRequestForm, isOrderReturnable, isWithinReturnWindow } from "@/components/return-request-form"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { HttpTypes } from "@medusajs/types"

export const Route = createFileRoute("/$countryCode/account/_layout/orders")({
  head: () => ({
    meta: [
      { title: "My Orders | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrdersPage,
})

function OrdersPage() {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"

  const [returnModalOrderId, setReturnModalOrderId] = useState<string | null>(null)

  const { data: orders, isLoading, isError, refetch } = useCustomerOrders({
    fields:
      "id,display_id,status,fulfillment_status,created_at,total,currency_code," +
      "items,*payment_collections.payment_sessions",
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
          My Orders
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
          Track and manage your medicine orders
        </p>
      </div>

      {isLoading ? (
        <AccountListSkeleton rows={3} />
      ) : isError ? (
        <div className="bg-[var(--bg-secondary)] border rounded-xl p-8 text-center" style={{ borderColor: "var(--border-primary)" }}>
          <p className="text-sm mb-3" style={{ color: "var(--text-tertiary)" }}>
            Unable to load your orders. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="text-sm font-medium underline transition-opacity hover:opacity-70"
            style={{ color: "var(--brand-teal)" }}
          >
            Retry
          </button>
        </div>
      ) : !orders?.length ? (
        <div className="bg-[var(--bg-secondary)] border rounded-xl p-12 text-center" style={{ borderColor: "var(--border-primary)" }}>
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
            style={{ background: "var(--bg-tertiary)" }}
          >
            <BoxIcon />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            No orders yet
          </h3>
          <p className="text-sm mb-6" style={{ color: "var(--text-tertiary)" }}>
            Your orders will appear here once you place them.
          </p>
          <Link
            to="/$countryCode/store"
            params={{ countryCode }}
            className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "var(--bg-inverse)" }}
          >
            Browse medicines
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => {
            const { summaryLabel, summaryColor, summaryBg } = deriveOrderProgress(
              order as unknown as HttpTypes.StoreOrder
            )
            return (
              <div
                key={order.id}
                className="bg-[var(--bg-secondary)] border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{ borderColor: "var(--border-primary)" }}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      Order #{order.display_id}
                    </span>
                    <span
                      className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                      style={{ color: summaryColor, background: summaryBg }}
                    >
                      {summaryLabel}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    Placed on {new Date(order.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  {order.items && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {formatPrice(order.total, order.currency_code)}
                  </span>
                  <Link
                    to="/$countryCode/order/$orderId/confirmed"
                    params={{ countryCode, orderId: order.id }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-all hover:bg-gray-50"
                    style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)" }}
                  >
                    View details
                  </Link>
                  {isOrderReturnable(order as any) &&
                    isWithinReturnWindow(String(order.created_at)) && (
                      <button
                        onClick={() => setReturnModalOrderId(order.id)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-all hover:bg-teal-50"
                        style={{ color: "var(--brand-teal)", borderColor: "var(--brand-teal)" }}
                      >
                        Request Return
                      </button>
                    )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Return request modal — rendered for the selected order */}
      {returnModalOrderId && (() => {
        const activeOrder = orders?.find((o) => o.id === returnModalOrderId)
        if (!activeOrder) return null
        return (
          <ReturnRequestForm
            order={{
              id: activeOrder.id,
              items: (activeOrder.items ?? []) as any,
              status: activeOrder.status,
              created_at: String(activeOrder.created_at),
              fulfillment_status: (activeOrder as any).fulfillment_status,
            }}
            isOpen={true}
            onClose={() => setReturnModalOrderId(null)}
          />
        )
      })()}
    </div>
  )
}

function formatPrice(amount: number, currencyCode: string) {
  if (!amount) return "—"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode?.toUpperCase() ?? "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

const BoxIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
  </svg>
)
