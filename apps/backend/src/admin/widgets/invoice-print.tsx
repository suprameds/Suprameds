import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Badge, toast } from "@medusajs/ui"
import { useState, useEffect } from "react"

const INDIA_POST_COD_ID = "52236"

const InvoicePrintWidget = ({
  data,
}: {
  data: { id: string; display_id?: string | number }
}) => {
  const orderId = data?.id
  const displayId = data?.display_id
  const [downloading, setDownloading] = useState(false)
  const [trackingId, setTrackingId] = useState("")
  const [paymentMode, setPaymentMode] = useState<"COD" | "PREPAID" | null>(null)

  // Detect payment mode on mount and auto-fill India Post ID for COD
  useEffect(() => {
    if (!orderId) return
    fetch(`/admin/orders/${orderId}?fields=payment_collections.payment_sessions.*`, { credentials: "include" })
      .then((r) => r.json())
      .then(({ order }) => {
        const sessions = order?.payment_collections?.[0]?.payment_sessions ?? []
        const isCod = !sessions.some((s: any) => s.provider_id?.includes("razorpay"))
        const mode = isCod ? "COD" : "PREPAID"
        setPaymentMode(mode as "COD" | "PREPAID")
        if (isCod) setTrackingId(INDIA_POST_COD_ID)
      })
      .catch(() => {})
  }, [orderId])

  if (!orderId) return null

  const handlePrintShippingLabel = async () => {
    try {
      const resp = await fetch(
        `/admin/orders/${orderId}?fields=id,display_id,created_at,total,items.*,shipping_address.*,payment_collections.payment_sessions.*`,
        { credentials: "include" }
      )
      if (!resp.ok) throw new Error("Failed to fetch order")
      const { order } = await resp.json()

      const addr = order.shipping_address || {}
      const customerName = [addr.first_name, addr.last_name].filter(Boolean).join(" ") || "—"
      const phone = addr.phone ? `+91 ${addr.phone.replace(/^\+?91\s?/, "")}` : ""
      const address = [addr.address_1, addr.address_2].filter(Boolean).join(", ")
      const city = addr.city || ""
      const state = addr.province || ""
      const pincode = addr.postal_code || ""
      const itemCount = (order.items || []).reduce((s: number, i: any) => s + Number(i.quantity), 0)
      const totalAmount = Math.round(
        (order.items || []).reduce((s: number, i: any) => s + Number(i.unit_price) * Number(i.quantity), 0)
      )

      let paymentMode = "COD"
      const sessions = order.payment_collections?.[0]?.payment_sessions ?? []
      if (sessions[0]?.provider_id?.includes("razorpay")) paymentMode = "PREPAID"

      const orderDate = new Date(order.created_at).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      })

      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      const isCod = paymentMode === "COD"
      const oid = `ORD${order.display_id ?? ""}`

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Shipping Label — ${esc(oid)}</title>
<style>
  @page { size: 100mm 100mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 100mm; height: 100mm;
    font-family: Arial, Helvetica, sans-serif;
    color: #000; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .label {
    width: 97.5mm; height: 96mm; margin: 1mm auto 0;
    padding: 2.5mm 3mm 3mm 3mm; display: flex; flex-direction: column;
  }
  .header {
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1.5pt solid #000; padding-bottom: 1.5mm; margin-bottom: 1.5mm;
  }
  .brand { font-size: 12pt; font-weight: 900; letter-spacing: 0.5pt; }
  .service-badge {
    font-size: 9.5pt; font-weight: 800; border: 1.5pt solid #000;
    padding: 1mm 2.5mm; text-transform: uppercase; letter-spacing: 0.5pt;
  }
  .header-order-id { font-size: 8pt; font-weight: 900; letter-spacing: 0.5pt; }
  .from-section {
    padding: 1mm 0; border-bottom: 0.5pt dashed #999; margin-bottom: 1.5mm;
  }
  .section-label {
    font-size: 7.5pt; font-weight: 800; text-transform: uppercase;
    letter-spacing: 1pt; color: #666; margin-bottom: 0.5mm;
  }
  .from-text { font-size: 8.5pt; line-height: 1.5; color: #333; }
  .from-mob { font-size: 9pt; font-weight: 900; margin-top: 0.5mm; letter-spacing: 0.5pt; }
  .to-section {
    padding: 1.5mm 0; flex: 1; border-bottom: 1pt solid #000; margin-bottom: 1.5mm;
  }
  .to-name { font-size: 11pt; font-weight: 900; margin-bottom: 1mm; line-height: 1.2; }
  .to-address { font-size: 8.5pt; line-height: 1.55; }
  .to-pincode {
    font-size: 13pt; font-weight: 900; margin-top: 1.5mm; letter-spacing: 2pt;
    display: inline-block; border: 1.5pt solid #000; padding: 0.5mm 2mm;
  }
  .to-city-state { font-size: 8.5pt; line-height: 1.55; margin-top: 0.5mm; }
  .to-phone { font-size: 11pt; font-weight: 900; margin-top: 1.5mm; letter-spacing: 0.5pt; }
  .bottom-row {
    display: flex; justify-content: space-between; align-items: center; padding-top: 1mm;
  }
  .order-info { font-size: 9pt; line-height: 1.7; color: #333; }
  .order-info strong { color: #000; }
  .payment-badge {
    font-size: 12pt; font-weight: 900; padding: 1mm 3mm;
    border: 2pt solid #000; text-align: center; min-width: 16mm;
  }
  .payment-badge.cod { background: #000; color: #fff; }
  .payment-badge.prepaid { background: #fff; color: #000; }
  .controls {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 10px; z-index: 100;
  }
  .controls button {
    padding: 12px 28px; font-size: 15px; font-weight: 700;
    border: none; border-radius: 8px; cursor: pointer; font-family: inherit;
  }
  .btn-print { background: #0D7C66; color: #fff; }
  .btn-print:hover { background: #0a6352; }
  .btn-close { background: #eee; color: #333; }
  .btn-close:hover { background: #ddd; }
  @media print { .controls { display: none !important; } }
  @media screen {
    body {
      background: #e5e5e5; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; flex-direction: column; gap: 16px;
    }
    .label {
      background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,0.15);
      border-radius: 2px; border: 1px solid #ccc;
    }
  }
</style>
</head>
<body>
<div class="label">
  <div class="header">
    <div>
      <div class="brand">SUPRAMEDS</div>
      <div class="header-order-id">${esc(oid)}</div>
    </div>
    <div><div class="service-badge">Speed Post</div></div>
  </div>
  <div class="from-section">
    <div class="section-label">From</div>
    <div class="from-text">Suprameds Pharmacy, SR Nagar, Hyderabad &ndash; 500038</div>
    <div class="from-mob">Mob: 7674962758</div>
  </div>
  <div class="to-section">
    <div class="section-label">Ship To</div>
    <div class="to-name">${esc(customerName)}</div>
    <div class="to-address">${esc(address)}</div>
    <div class="to-pincode">${esc(pincode)}</div>
    <div class="to-city-state">${esc(city)}, ${esc(state)}</div>
    <div class="to-phone">${esc(phone)}</div>
  </div>
  <div class="bottom-row">
    <div class="order-info">
      <strong>Date:</strong> ${esc(orderDate)}<br>
      <strong>Items:</strong> ${itemCount}
    </div>
    <div style="display:flex;align-items:center;gap:2mm;">
      ${trackingId ? `<div style="font-size:11pt;font-weight:900;color:#000;text-align:right;">ID<br>${esc(trackingId)}</div>` : ""}
      <div class="payment-badge ${isCod ? "cod" : "prepaid"}">${isCod ? "COD ₹" + totalAmount : "PREPAID"}</div>
    </div>
  </div>
</div>
<div class="controls">
  <button class="btn-print" onclick="window.print()">Print Label</button>
  <button class="btn-close" onclick="window.close()">Close</button>
</div>
</body>
</html>`

      const popup = window.open("", `label-${orderId}`, "width=500,height=550")
      if (popup) {
        popup.document.open()
        popup.document.write(html)
        popup.document.close()
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate shipping label")
    }
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Heading level="h2">Print</Heading>
          {paymentMode && (
            <Badge color={paymentMode === "COD" ? "orange" : "green"}>
              {paymentMode === "COD" ? "Cash on Delivery" : "Prepaid (Razorpay)"}
            </Badge>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {paymentMode === "COD" && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
            India Post ID: {INDIA_POST_COD_ID}
          </span>
        )}
        <Button
          variant="secondary"
          size="small"
          onClick={handlePrintShippingLabel}
        >
          Shipping Label (4x4)
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
