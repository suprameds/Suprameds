import { createFileRoute, Link } from "@tanstack/react-router"
import { useCustomerOrders } from "@/lib/hooks/use-orders"
import { deriveOrderProgress } from "@/components/order"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { useLocation } from "@tanstack/react-router"
import { HttpTypes } from "@medusajs/types"

export const Route = createFileRoute("/$countryCode/account/_layout/orders")({
  component: OrdersPage,
})

function OrdersPage() {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"

  const { data: orders, isLoading } = useCustomerOrders({
    fields:
      "id,display_id,status,fulfillment_status,created_at,total,currency_code," +
      "items,*payment_collections.payment_sessions",
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-serif font-semibold" style={{ color: "#0D1B2A" }}>
          My Orders
        </h1>
        <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
          Track and manage your medicine orders
        </p>
      </div>

      {isLoading ? (
        <div className="bg-white border rounded-xl p-8 text-center" style={{ borderColor: "#EDE9E1" }}>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>Loading your orders...</p>
        </div>
      ) : !orders?.length ? (
        <div className="bg-white border rounded-xl p-12 text-center" style={{ borderColor: "#EDE9E1" }}>
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
            style={{ background: "#F3F4F6" }}
          >
            <BoxIcon />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: "#111827" }}>
            No orders yet
          </h3>
          <p className="text-sm mb-6" style={{ color: "#9CA3AF" }}>
            Your orders will appear here once you place them.
          </p>
          <Link
            to="/$countryCode/store"
            params={{ countryCode }}
            className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "#0D1B2A" }}
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
                className="bg-white border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{ borderColor: "#EDE9E1" }}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold" style={{ color: "#111827" }}>
                      Order #{order.display_id}
                    </span>
                    <span
                      className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                      style={{ color: summaryColor, background: summaryBg }}
                    >
                      {summaryLabel}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>
                    Placed on {new Date(order.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  {order.items && (
                    <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                      {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold" style={{ color: "#0D1B2A" }}>
                    {formatPrice(order.total, order.currency_code)}
                  </span>
                  <Link
                    to="/$countryCode/order/$orderId/confirmed"
                    params={{ countryCode, orderId: order.id }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-all hover:bg-gray-50"
                    style={{ color: "#0D1B2A", borderColor: "#D1D5DB" }}
                  >
                    View details
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
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
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
  </svg>
)
