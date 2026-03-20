import Address from "@/components/address"
import PaymentMethodInfo from "@/components/payment-method-info"
import { Price } from "@/components/ui/price"
import { Thumbnail } from "@/components/ui/thumbnail"
import { isPaidWithGiftCard } from "@/lib/utils/checkout"
import { formatOrderId } from "@/lib/utils/order"
import { HttpTypes } from "@medusajs/types"

type OrderInfoProps = {
  order: HttpTypes.StoreOrder
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:            { label: "Pending",           color: "#92400E", bg: "#FEF3C7" },
  processing:         { label: "Processing",         color: "#1E40AF", bg: "#DBEAFE" },
  completed:          { label: "Completed",          color: "#065F46", bg: "#ECFDF5" },
  cancelled:          { label: "Cancelled",          color: "#991B1B", bg: "#FEF2F2" },
  requires_action:    { label: "Action needed",      color: "#7C3AED", bg: "#EDE9FE" },
  not_fulfilled:      { label: "Not shipped",        color: "#6B7280", bg: "#F3F4F6" },
  partially_fulfilled:{ label: "Partially shipped",  color: "#92400E", bg: "#FEF3C7" },
  fulfilled:          { label: "Shipped",            color: "#065F46", bg: "#ECFDF5" },
  partially_shipped:  { label: "Partially shipped",  color: "#92400E", bg: "#FEF3C7" },
  shipped:            { label: "Shipped",            color: "#065F46", bg: "#ECFDF5" },
  partially_returned: { label: "Partially returned", color: "#7C3AED", bg: "#EDE9FE" },
  returned:           { label: "Returned",           color: "#991B1B", bg: "#FEF2F2" },
  delivered:          { label: "Delivered",          color: "#065F46", bg: "#ECFDF5" },
}

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_LABELS[status] ?? { label: status, color: "#374151", bg: "#F3F4F6" }
  return (
    <span
      className="text-xs font-medium px-2.5 py-0.5 rounded-full"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  )
}

/** Medusa v2: tracking may live on tracking_links or fulfillment labels */
function collectTrackingEntries(fulfillments: any[] | undefined): { key: string; number: string; url?: string }[] {
  if (!fulfillments?.length) return []
  const out: { key: string; number: string; url?: string }[] = []
  for (const f of fulfillments) {
    for (const t of f.tracking_links ?? []) {
      if (t?.tracking_number) {
        out.push({
          key: `tl-${f.id ?? "f"}-${t.tracking_number}`,
          number: t.tracking_number,
          url: t.url ?? undefined,
        })
      }
    }
    for (const lab of f.labels ?? []) {
      const num = lab.tracking_number ?? lab.trackingNumber
      if (num) {
        out.push({
          key: `lb-${f.id ?? "f"}-${num}`,
          number: String(num),
          url: lab.tracking_url ?? lab.trackingUrl ?? undefined,
        })
      }
    }
  }
  return out
}

export const OrderInfo = ({ order }: OrderInfoProps) => {
  const fulfillmentStatus = (order as any).fulfillment_status as string | undefined
  const fulfillments = (order as any).fulfillments as any[] | undefined
  const trackingEntries = collectTrackingEntries(fulfillments)

  // Medusa: `status` is the order lifecycle (pending / completed / canceled / …).
  // `fulfillment_status` is packing → shipped → delivered. They are updated by different workflows.
  const showPendingExplainer =
    order.status === "pending" &&
    fulfillmentStatus &&
    fulfillmentStatus !== "not_fulfilled" &&
    fulfillmentStatus !== "canceled"

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold">Order Details</h3>
      <div className="flex gap-2 items-center">
        <span className="text-base font-semibold text-zinc-900">Order ID:</span>
        <span className="text-sm text-zinc-600">
          {formatOrderId(String(order.display_id ?? order.id ?? ""))}
        </span>
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-base font-semibold text-zinc-900">Order Date:</span>
        <span className="text-sm text-zinc-600">
          {new Date(order.created_at!).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {/* What customers care about first */}
      {fulfillmentStatus && (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-base font-semibold text-zinc-900">Delivery status:</span>
            <StatusBadge status={fulfillmentStatus} />
          </div>
          <p className="text-xs text-zinc-500 max-w-xl">
            This follows your shipment in Admin (packed → shipped → delivered).
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-base font-semibold text-zinc-900">Order record:</span>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-xs text-zinc-500 max-w-xl">
          In Medusa, <strong>Pending</strong> means the order record is still open. It becomes{" "}
          <strong>Completed</strong> when the backend runs the complete-order workflow (this project auto-runs it once
          the whole order&apos;s <strong>delivery status</strong> is <strong>Delivered</strong>, or staff can complete
          manually in Admin.)
        </p>
        {showPendingExplainer && (
          <p className="text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 max-w-xl mt-1">
            If you still see <strong>Pending</strong> with <strong>Delivered</strong> here, wait a few seconds and
            refresh—the subscriber may still be processing. If it persists, use{" "}
            <strong>Admin → Orders → Complete order</strong>, or check that every fulfillment for this order is marked
            delivered (partial deliveries keep the record pending until all are delivered).
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold text-zinc-900">Tracking:</span>
        {trackingEntries.length > 0 ? (
          trackingEntries.map((t) => (
            <span key={t.key} className="text-sm text-zinc-600">
              {t.url ? (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-600 hover:text-blue-800"
                >
                  {t.number}
                </a>
              ) : (
                t.number
              )}
            </span>
          ))
        ) : (
          <span className="text-sm text-zinc-500">
            No tracking number in this order yet. If you shipped from Admin without a tracking label, this stays
            empty.
          </span>
        )}
      </div>

      <div className="flex gap-2 items-center">
        <span className="text-base font-semibold text-zinc-900">Order Email:</span>
        <span className="text-sm text-zinc-600">
          {order.customer?.email ?? order.email ?? "N/A"}
        </span>
      </div>
    </div>
  )
}

type OrderLineItemProps = {
  item: HttpTypes.StoreOrderLineItem
  order: HttpTypes.StoreOrder
}

export const OrderLineItem = ({ item, order }: OrderLineItemProps) => {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-zinc-200 last:border-b-0">
      <Thumbnail
        thumbnail={item.thumbnail}
        alt={item.product_title || item.title}
        className="w-16 h-16"
      />
      <div className="flex-1 flex flex-col gap-y-1">
        <span className="text-base font-semibold text-zinc-900">{item.product_title}</span>
        {item.variant_title && item.variant_title !== "Default Variant" && (
          <span className="text-sm text-zinc-600">{item.variant_title}</span>
        )}
        <span className="text-sm text-zinc-600">Quantity: {item.quantity}</span>
      </div>
      <div className="text-right">
        <Price
          price={item.total}
          currencyCode={order.currency_code}
          className="text-zinc-600"
        />
      </div>
    </div>
  )
}

type OrderSummaryProps = {
  order: HttpTypes.StoreOrder
}

export const OrderSummary = ({ order }: OrderSummaryProps) => {
  return (
    <div className="space-y-4">
      <h3 className="mb-4 font-semibold">Summary</h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-600">Subtotal</span>
          <Price
            price={order.subtotal}
            currencyCode={order.currency_code}
            className="text-zinc-600"
          />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-zinc-600">Shipping</span>
          <Price
            price={order.shipping_total}
            currencyCode={order.currency_code}
            className="text-zinc-600"
          />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-zinc-600">Discount</span>
          <Price
            price={order.discount_total}
            currencyCode={order.currency_code}
            type="discount"
            className="text-zinc-600"
          />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-zinc-600">Tax</span>
          <Price
            price={order.tax_total}
            currencyCode={order.currency_code}
            className="text-zinc-600"
          />
        </div>
      </div>

      <hr className="bg-zinc-200" />

      <div className="flex justify-between">
        <span className="text-zinc-900 text-sm">Total</span>
        <Price price={order.total} currencyCode={order.currency_code} />
      </div>
    </div>
  )
}

type OrderShippingProps = {
  order: HttpTypes.StoreOrder
}

export const OrderShipping = ({ order }: OrderShippingProps) => {
  return (
    <div>
      <h3 className="mb-4 font-semibold">Delivery Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <span className="text-base font-semibold text-zinc-900 mb-2">
            Shipping Address
          </span>
          {order.shipping_address && <Address address={order.shipping_address} />}
        </div>

        {order.shipping_methods?.[0] && (
          <div>
            <span className="text-base font-semibold text-zinc-900 mb-2">
              Shipping Method
            </span>
            <div className="text-sm text-zinc-600 flex items-center justify-between">
              <div>{order.shipping_methods[0].name}</div>
              <Price
                price={order.shipping_methods[0].amount}
                currencyCode={order.currency_code}
                className="text-zinc-600"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type OrderBillingProps = {
  order: HttpTypes.StoreOrder
}

export const OrderBilling = ({ order }: OrderBillingProps) => {
  const paidByGiftcard = isPaidWithGiftCard(order)

  return (
    <div>
      <h3 className="mb-4">Billing Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <span className="text-base font-semibold text-zinc-900 mb-2">
            Billing Address
          </span>
          <div className="text-sm text-zinc-600">
            {order.billing_address ? (
              <Address address={order.billing_address} />
            ) : (
              <span>Same as shipping address</span>
            )}
          </div>
        </div>
        <div>
          <span className="text-base font-semibold text-zinc-900 mb-2">Payment Method</span>
          <div className="text-sm text-zinc-600">
            {order.payment_collections?.[0].payment_sessions?.[0] && (
              <PaymentMethodInfo
                provider_id={order.payment_collections[0].payment_sessions[0].provider_id}
              />
            )}
            {paidByGiftcard && <span>Gift Card</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

interface OrderDetailsProps {
  order: HttpTypes.StoreOrder
}

export const OrderDetails = ({ order }: OrderDetailsProps) => {
  return (
    <div>
      <div className="flex flex-col gap-8">
        <OrderInfo order={order} />
        <hr className="bg-zinc-200" />
        <div className="flex flex-col gap-4">
          <h3 className="mb-4 font-semibold">Items</h3>
          {order.items?.map((item) => (
            <OrderLineItem key={item.id} item={item} order={order} />
          ))}
        </div>
        <hr className="bg-zinc-200" />
        <OrderShipping order={order} />
        <hr className="bg-zinc-200" />
        <OrderBilling order={order} />
        <hr className="bg-zinc-200" />
        <OrderSummary order={order} />
      </div>
    </div>
  )
}

export default OrderDetails
