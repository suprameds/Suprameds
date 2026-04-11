import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { sdk } from "../lib/client"

type PaymentStatus = {
  type: "prepaid" | "cod"
  payment_status: "pending" | "authorized" | "captured" | "refunded"
  provider: string
  amount: number
}

const PaymentStatusBadge = () => {
  const { id: orderId } = useParams<{ id: string }>()
  const [status, setStatus] = useState<PaymentStatus | null>(null)

  useEffect(() => {
    if (!orderId) return

    sdk.client
      .fetch<any>(`/admin/orders/${orderId}`, {
        query: { fields: "payment_collection.payment_sessions.*,payment_collection.payments.*" },
      })
      .then((res: any) => {
        const order = res.order
        const sessions =
          order?.payment_collection?.payment_sessions || []
        const payments = order?.payment_collection?.payments || []

        const session = sessions[0]
        const payment = payments[0]
        const isPrepaid = session?.provider_id?.includes("paytm") || session?.provider_id?.includes("razorpay")
        const isCaptured = payment?.captured_at != null

        setStatus({
          type: isPrepaid ? "prepaid" : "cod",
          payment_status: isCaptured
            ? "captured"
            : payment
              ? "authorized"
              : "pending",
          provider: isPrepaid ? (session?.provider_id?.includes("paytm") ? "Paytm" : "Razorpay") : "Cash on Delivery",
          amount: payment?.amount || session?.amount || 0,
        })
      })
      .catch(() => {
        /* non-fatal — widget simply won't render */
      })
  }, [orderId])

  if (!status) return null

  const badge =
    status.type === "prepaid" ? (
      status.payment_status === "captured" ? (
        <Badge color="green">Paid Online</Badge>
      ) : (
        <Badge color="orange">Online — Pending Capture</Badge>
      )
    ) : status.payment_status === "captured" ? (
      <Badge color="green">COD — Payment Received</Badge>
    ) : (
      <Badge color="orange">COD — Awaiting Delivery</Badge>
    )

  return (
    <Container className="p-4">
      <div className="flex items-center justify-between">
        <Text className="text-sm font-medium">Payment</Text>
        {badge}
      </div>
      <Text className="text-xs text-ui-fg-muted mt-1">
        {status.provider} · ₹{status.amount}
      </Text>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default PaymentStatusBadge
