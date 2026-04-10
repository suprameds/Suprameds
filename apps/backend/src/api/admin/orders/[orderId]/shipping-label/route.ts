import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/orders/:orderId/shipping-label
 *
 * Returns a self-contained 100mm × 100mm HTML shipping label
 * for the TVS LP 46 Neo thermal printer (4×4 label stock).
 * Opens in a new tab — user clicks Print.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { orderId } = req.params

  if (!orderId) {
    return res.status(400).json({ message: "orderId is required" })
  }

  try {
    // Fetch order with shipping address, items, payment info
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "created_at",
        "total",
        "items.*",
        "shipping_address.*",
        "payment_collections.payment_sessions.*",
      ],
      filters: { id: orderId },
    }) as any

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    // Determine customer info
    const addr = order.shipping_address || {}
    const customerName = [addr.first_name, addr.last_name].filter(Boolean).join(" ") || "—"
    const phone = addr.phone ? `+91 ${addr.phone.replace(/^\+?91\s?/, "")}` : ""
    const address = [addr.address_1, addr.address_2].filter(Boolean).join(", ")
    const city = addr.city || ""
    const state = addr.province || ""
    const pincode = addr.postal_code || ""

    // Item count
    const itemCount = (order.items || []).reduce((sum: number, i: any) => sum + Number(i.quantity), 0)

    // Total amount (includes items + shipping + tax)
    const totalAmount = Number(order.total) || (order.items || []).reduce(
      (sum: number, i: any) => sum + Number(i.unit_price) * Number(i.quantity),
      0
    )

    // Payment mode detection
    let paymentMode = "COD"
    const sessions = order.payment_collections?.[0]?.payment_sessions ?? []
    const providerId = sessions[0]?.provider_id ?? ""
    if (providerId.includes("razorpay")) {
      paymentMode = "PREPAID"
    }

    // Format date
    const orderDate = new Date(order.created_at).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })

    const html = renderShippingLabel({
      orderId: `ORD${order.display_id ?? ""}`,
      customerName,
      phone,
      address,
      city,
      state,
      pincode,
      itemCount,
      totalAmount: Math.round(totalAmount),
      paymentMode,
      orderDate,
      displayId: order.display_id,
    })

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    return res.send(html)
  } catch (err: any) {
    logger.error(`[shipping-label] Failed for ${orderId}: ${err?.message}`)
    return res.status(500).json({ message: err?.message || "Failed to generate shipping label" })
  }
}

function esc(s: string | undefined | null): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function renderShippingLabel(data: {
  orderId: string
  customerName: string
  phone: string
  address: string
  city: string
  state: string
  pincode: string
  itemCount: number
  totalAmount: number
  paymentMode: string
  orderDate: string
  displayId: number | string
}): string {
  const isCod = data.paymentMode === "COD"

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Shipping Label — ${esc(data.orderId)}</title>
<style>
  @page {
    size: 100mm 100mm;
    margin: 0;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 100mm;
    height: 100mm;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .label {
    width: 97.5mm;
    height: 96mm;
    margin: 1mm auto 0;
    padding: 2.5mm 3mm 3mm 3mm;
    display: flex;
    flex-direction: column;
  }

  /* ── HEADER ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5pt solid #000;
    padding-bottom: 1.5mm;
    margin-bottom: 1.5mm;
  }
  .brand {
    font-size: 12pt;
    font-weight: 900;
    letter-spacing: 0.5pt;
  }
  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1mm;
  }
  .service-badge {
    font-size: 9.5pt;
    font-weight: 800;
    border: 1.5pt solid #000;
    padding: 1mm 2.5mm;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
  }
  .header-order-id {
    font-size: 8pt;
    font-weight: 900;
    color: #000;
    letter-spacing: 0.5pt;
  }

  /* ── FROM ── */
  .from-section {
    padding: 1mm 0;
    border-bottom: 0.5pt dashed #999;
    margin-bottom: 1.5mm;
  }
  .section-label {
    font-size: 7.5pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1pt;
    color: #666;
    margin-bottom: 0.5mm;
  }
  .from-text {
    font-size: 8.5pt;
    line-height: 1.5;
    color: #333;
  }
  .from-mob {
    font-size: 9pt;
    font-weight: 900;
    color: #000;
    margin-top: 0.5mm;
    letter-spacing: 0.5pt;
  }

  /* ── TO ── */
  .to-section {
    padding: 1.5mm 0;
    flex: 1;
    border-bottom: 1pt solid #000;
    margin-bottom: 1.5mm;
  }
  .to-name {
    font-size: 11pt;
    font-weight: 900;
    margin-bottom: 1mm;
    line-height: 1.2;
  }
  .to-address {
    font-size: 8.5pt;
    line-height: 1.55;
  }
  .to-pincode {
    font-size: 13pt;
    font-weight: 900;
    margin-top: 1.5mm;
    letter-spacing: 2pt;
    display: inline-block;
    border: 1.5pt solid #000;
    padding: 0.5mm 2mm;
  }
  .to-city-state {
    font-size: 8.5pt;
    line-height: 1.55;
    margin-top: 0.5mm;
  }
  .to-phone {
    font-size: 11pt;
    font-weight: 900;
    color: #000;
    margin-top: 1.5mm;
    letter-spacing: 0.5pt;
  }

  /* ── BOTTOM ROW ── */
  .bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1mm;
  }
  .order-info {
    font-size: 9pt;
    line-height: 1.7;
    color: #333;
  }
  .order-info strong {
    color: #000;
  }
  .payment-badge {
    font-size: 12pt;
    font-weight: 900;
    padding: 1mm 3mm;
    border: 2pt solid #000;
    text-align: center;
    min-width: 16mm;
  }
  .payment-badge.cod {
    background: #000;
    color: #fff;
  }
  .payment-badge.prepaid {
    background: #fff;
    color: #000;
  }

  /* ── PRINT CONTROLS ── */
  .controls {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    z-index: 100;
    font-family: Arial, sans-serif;
  }
  .controls button {
    padding: 12px 28px;
    font-size: 15px;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-print { background: #0D7C66; color: #fff; }
  .btn-print:hover { background: #0a6352; }
  .btn-close { background: #eee; color: #333; }
  .btn-close:hover { background: #ddd; }

  @media print {
    .controls { display: none !important; }
  }

  @media screen {
    body {
      background: #e5e5e5;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      flex-direction: column;
      gap: 16px;
    }
    .label {
      background: #fff;
      box-shadow: 0 4px 24px rgba(0,0,0,0.15);
      border-radius: 2px;
      border: 1px solid #ccc;
    }
  }
</style>
</head>
<body>

<div class="label">

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="brand">SUPRAMEDS</div>
      <div class="header-order-id">${esc(data.orderId)}</div>
    </div>
    <div class="header-right">
      <div class="service-badge">Speed Post</div>
    </div>
  </div>

  <!-- FROM -->
  <div class="from-section">
    <div class="section-label">From</div>
    <div class="from-text">SR Nagar, Hyderabad &ndash; 500038</div>
    <div class="from-mob">Mob: 7674962758</div>
  </div>

  <!-- TO -->
  <div class="to-section">
    <div class="section-label">Ship To</div>
    <div class="to-name">${esc(data.customerName)}</div>
    <div class="to-address">${esc(data.address)}</div>
    <div class="to-pincode">${esc(data.pincode)}</div>
    <div class="to-city-state">${esc(data.city)}, ${esc(data.state)}</div>
    <div class="to-phone">${esc(data.phone)}</div>
  </div>

  <!-- BOTTOM ROW -->
  <div class="bottom-row">
    <div class="order-info">
      <strong>Date:</strong> ${esc(data.orderDate)}<br>
      <strong>Items:</strong> ${data.itemCount}
    </div>
    <div style="display:flex;align-items:center;gap:2mm;">
      ${isCod ? `<div style="font-size:11pt;font-weight:900;color:#000;text-align:right;">ID<br>53326</div>` : ""}
      <div class="payment-badge ${isCod ? "cod" : "prepaid"}">${isCod ? `COD ₹${data.totalAmount}` : "PREPAID"}</div>
    </div>
  </div>

</div>

<!-- CONTROLS -->
<div class="controls">
  <button class="btn-print" onclick="window.print()">Print Label</button>
  <button class="btn-close" onclick="window.close()">Close</button>
</div>

</body>
</html>`
}
