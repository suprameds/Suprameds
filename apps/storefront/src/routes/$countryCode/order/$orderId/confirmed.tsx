/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, notFound } from "@tanstack/react-router"
import OrderConfirmationPage from "@/pages/order-confirmation"
import { retrieveOrder } from "@/lib/data/order"
import { queryKeys } from "@/lib/utils/query-keys"

const ORDER_FIELDS =
  "id, display_id, created_at, currency_code, status, fulfillment_status, email, " +
  "*items, *shipping_address, *billing_address, *shipping_methods, " +
  "*payment_collections, *payment_collections.payment_sessions, " +
  "*fulfillments, *fulfillments.labels, *fulfillments.items, " +
  "subtotal, shipping_total, discount_total, tax_total, total"

export const Route = createFileRoute("/$countryCode/order/$orderId/confirmed")({
  head: () => ({
    meta: [
      { title: "Order Confirmed | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: async ({ params, context }) => {
    const { countryCode, orderId } = params
    const { queryClient } = context

    // Always fetch fresh — never serve stale cache for order details
    const order = await queryClient.fetchQuery({
      queryKey: queryKeys.orders.detail(orderId),
      queryFn: () => retrieveOrder({ order_id: orderId, fields: ORDER_FIELDS }),
      staleTime: 0,
    })

    if (!order) {
      throw notFound()
    }

    return { countryCode, orderId }
  },
  component: OrderConfirmationPage,
})

export { ORDER_FIELDS }