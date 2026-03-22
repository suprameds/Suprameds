import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Container, Heading, Badge, Text, Button } from "@medusajs/ui"

type CodOrderData = {
  id: string
  order_id: string
  status: string
  cod_amount: number
  surcharge_amount: number
  confirmation_required: boolean
  confirmed_at: string | null
  phone_verified: boolean
  confirmation_attempts: number
}

const STATUS_COLORS: Record<string, "green" | "orange" | "red" | "blue" | "grey" | "purple"> = {
  pending_confirmation: "orange",
  confirmed: "green",
  dispatched: "blue",
  delivered_collected: "green",
  rto: "red",
  cancelled: "red",
}

const STATUS_LABELS: Record<string, string> = {
  pending_confirmation: "Pending Confirmation",
  confirmed: "Confirmed",
  dispatched: "Dispatched",
  delivered_collected: "Delivered & Collected",
  rto: "RTO",
  cancelled: "Cancelled",
}

/**
 * Admin widget showing COD verification status on the order detail page.
 * Displays COD amount, surcharge, confirmation status, phone verification,
 * and allows manual confirmation by admin.
 */
const CodVerificationStatusWidget = () => {
  const { id: orderId } = useParams<{ id: string }>()
  const [codOrder, setCodOrder] = useState<CodOrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCodStatus = async () => {
    if (!orderId) return
    try {
      setLoading(true)
      const response = await fetch(
        `/store/orders/cod-confirm?order_id=${orderId}`
      )

      if (response.status === 404) {
        // Not a COD order
        setCodOrder(null)
        return
      }

      if (!response.ok) {
        throw new Error("Failed to fetch COD status")
      }

      const json = await response.json()
      setCodOrder(json.cod_order)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCodStatus()
  }, [orderId])

  // Not a COD order — don't render widget
  if (!loading && !codOrder) return null

  const handleManualConfirm = async () => {
    setConfirming(true)
    setError(null)

    try {
      const response = await fetch("/store/orders/cod-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          confirmed: true,
        }),
      })

      if (!response.ok) {
        const json = await response.json()
        throw new Error(json.message || "Confirmation failed")
      }

      await fetchCodStatus()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">COD Verification</Heading>
          <Text className="text-ui-fg-subtle">Loading...</Text>
        </div>
      </Container>
    )
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">COD Verification</Heading>
        <Badge color={STATUS_COLORS[codOrder!.status] || "grey"}>
          {STATUS_LABELS[codOrder!.status] || codOrder!.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6 py-4">
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            COD Amount
          </Text>
          <Text className="font-medium">₹{codOrder!.cod_amount}</Text>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Surcharge
          </Text>
          <Text className="font-medium">₹{codOrder!.surcharge_amount}</Text>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Phone Verified
          </Text>
          <Text className="font-medium">
            {codOrder!.phone_verified ? "Yes" : "No"}
          </Text>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-subtle">
            Confirmation Attempts
          </Text>
          <Text className="font-medium">
            {codOrder!.confirmation_attempts}
          </Text>
        </div>
        {codOrder!.confirmed_at && (
          <div className="col-span-2">
            <Text size="small" className="text-ui-fg-subtle">
              Confirmed At
            </Text>
            <Text className="font-medium">
              {new Date(codOrder!.confirmed_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}
            </Text>
          </div>
        )}
      </div>

      {error && (
        <div className="px-6 py-2">
          <Text className="text-ui-fg-error">{error}</Text>
        </div>
      )}

      {codOrder!.status === "pending_confirmation" && (
        <div className="flex justify-end gap-2 px-6 py-4">
          <Button
            variant="primary"
            size="small"
            disabled={confirming}
            onClick={handleManualConfirm}
          >
            {confirming ? "Confirming..." : "Manually Confirm"}
          </Button>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default CodVerificationStatusWidget
