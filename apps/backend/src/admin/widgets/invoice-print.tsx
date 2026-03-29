import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, toast } from "@medusajs/ui"
import { useState } from "react"

const InvoicePrintWidget = ({
  data,
}: {
  data: { id: string; display_id?: string | number }
}) => {
  const orderId = data?.id
  const displayId = data?.display_id
  const [downloading, setDownloading] = useState(false)

  if (!orderId) return null

  const handlePrintShippingLabel = () => {
    window.open(
      `/admin/orders/${orderId}/shipping-label`,
      `label-${orderId}`,
      "width=500,height=550"
    )
  }

  const handlePrintInvoice = () => {
    window.open(
      `/admin/orders/${orderId}/invoice`,
      `invoice-${orderId}`,
      "width=900,height=700"
    )
  }

  const handleDownloadInvoicePdf = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/admin/invoices/${orderId}/pdf`, {
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Download failed" }))
        throw new Error(err.message || "Download failed")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `invoice-order-${displayId ?? orderId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("Invoice PDF downloaded")
    } catch (err: any) {
      toast.error(err?.message || "Failed to download invoice")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Container>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Heading level="h2">Print</Heading>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          variant="secondary"
          size="small"
          onClick={handlePrintShippingLabel}
        >
          Shipping Label (4×4)
        </Button>
        <Button
          variant="secondary"
          size="small"
          onClick={handlePrintInvoice}
        >
          Print Invoice (A4)
        </Button>
        <Button
          variant="secondary"
          size="small"
          onClick={handleDownloadInvoicePdf}
          isLoading={downloading}
        >
          Download Invoice PDF
        </Button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default InvoicePrintWidget
