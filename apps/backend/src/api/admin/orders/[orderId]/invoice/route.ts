import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { buildGstInvoice, GstInvoice } from "../../../../../utils/gst-invoice"

/**
 * GET /admin/orders/:orderId/invoice
 *
 * Returns a self-contained printable A4 HTML GST invoice matching the
 * Supracyn Pharma invoice format. Opens in new tab — user clicks Print.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { orderId } = req.params

  if (!orderId) {
    return res.status(400).json({ message: "orderId is required" })
  }

  try {
    const invoice = await buildGstInvoice(req.scope, orderId)

    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "shipping_address.*"],
      filters: { id: orderId },
    }) as any

    const buyerPhone = order?.shipping_address?.phone || ""
    const displayId = order?.display_id || ""

    const html = renderPrintableInvoice(invoice, {
      orderDisplayId: `ORD${displayId}`,
      buyerPhone,
    })

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    return res.send(html)
  } catch (err: any) {
    logger.error(`[invoice-print] Failed for ${orderId}: ${err?.message}`)
    return res.status(500).json({ message: err?.message || "Failed to generate invoice" })
  }
}

function esc(s: string | undefined | null): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function renderPrintableInvoice(
  inv: GstInvoice,
  extra: { orderDisplayId: string; buyerPhone: string }
): string {
  const itemRows = inv.items
    .map((it, i) => {
      const discPct =
        it.unit_mrp > 0
          ? Math.round(((it.unit_mrp - it.unit_selling_price) / it.unit_mrp) * 100)
          : 0
      const gstTotal = it.cgst_amount + it.sgst_amount + it.igst_amount
      return `
    <tr>
      <td>${i + 1}</td>
      <td class="l"><strong>${esc(it.product_title)}</strong></td>
      <td>${esc(it.batch_number)}</td>
      <td>${esc(it.expiry_date)}</td>
      <td class="r">₹ ${it.unit_mrp.toFixed(2)}</td>
      <td>${it.quantity}</td>
      <td>St</td>
      <td class="r">₹ ${it.unit_selling_price.toFixed(2)}</td>
      <td class="r">₹ ${it.discount_amount.toFixed(2)}<br><span class="dim">(${discPct}%)</span></td>
      <td class="r">₹ ${gstTotal.toFixed(2)} (${it.gst_rate}%)</td>
      <td class="r">₹ ${it.line_total.toFixed(2)}</td>
    </tr>`
    })
    .join("")

  const totalQty = inv.items.reduce((s, i) => s + i.quantity, 0)
  const subTotal = inv.grand_total
  const roundOff = Math.round(subTotal) - subTotal
  const total = Math.round(subTotal)
  const youSaved = inv.total_discount

  // HSN breakdown
  const hsnMap = new Map<string, { taxable: number; cgst: number; sgst: number; igst: number; rate: number }>()
  for (const it of inv.items) {
    const hsn = it.hsn_code || "3004"
    const existing = hsnMap.get(hsn) || { taxable: 0, cgst: 0, sgst: 0, igst: 0, rate: it.gst_rate }
    existing.taxable += it.taxable_value
    existing.cgst += it.cgst_amount
    existing.sgst += it.sgst_amount
    existing.igst += it.igst_amount
    hsnMap.set(hsn, existing)
  }

  const hsnRows = Array.from(hsnMap.entries())
    .map(([hsn, v]) => {
      const halfRate = (v.rate / 2).toFixed(1)
      const totalTax = v.cgst + v.sgst + v.igst
      return inv.is_intra_state
        ? `<tr>
            <td class="l">${esc(hsn)}</td>
            <td class="r">₹ ${v.taxable.toFixed(2)}</td>
            <td>${halfRate}%</td>
            <td class="r">₹ ${v.cgst.toFixed(2)}</td>
            <td>${halfRate}%</td>
            <td class="r">₹ ${v.sgst.toFixed(2)}</td>
            <td class="r">₹ ${totalTax.toFixed(2)}</td>
          </tr>`
        : `<tr>
            <td class="l">${esc(hsn)}</td>
            <td class="r">₹ ${v.taxable.toFixed(2)}</td>
            <td>${v.rate}%</td>
            <td class="r">₹ ${v.igst.toFixed(2)}</td>
            <td class="r">₹ ${totalTax.toFixed(2)}</td>
          </tr>`
    })
    .join("")

  // DL numbers
  const dlNumber = inv.seller_dl_number || ""
  const dlNumbers = dlNumber.includes("|")
    ? dlNumber.split("|").map((d) => d.trim())
    : dlNumber.includes(",")
    ? dlNumber.split(",").map((d) => d.trim())
    : [dlNumber]

  // Spacer rows to fill the page — 8 total rows max (like Vyapari)
  const spacerCount = Math.max(0, 8 - inv.items.length)
  const spacerRows = Array(spacerCount)
    .fill('<tr class="spacer"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>')
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700;900&display=swap" rel="stylesheet">
<title>Tax Invoice — ${esc(inv.invoice_number)}</title>
<style>
  @page { size: A4 portrait; margin: 8mm 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Noto Sans', Arial, Helvetica, sans-serif;
    color: #000;
    background: #fff;
    font-size: 9pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /*
   * BORDER STRATEGY: Only ONE element owns each border line.
   * - .inv owns the outer 2pt frame (top/bottom/left/right)
   * - Horizontal dividers: only the UPPER section has border-bottom
   * - Tables: first/last column cells have NO left/right border
   *   (the .inv frame provides those edges)
   * - Between a div and a table: the div has border-bottom,
   *   the table's first row has NO border-top
   */

  .inv {
    width: 100%;
    max-width: 190mm;
    margin: 0 auto;
    border: 1pt solid #000;
  }

  /* ── TITLE ── */
  .title {
    text-align: center;
    font-size: 12pt;
    font-weight: 900;
    padding: 2.5mm 0;
    border-bottom: 1pt solid #000;
  }

  /* ── HEADER ── */
  .hdr { display: flex; border-bottom: 1pt solid #000; }
  .hdr-left { flex: 1; padding: 3mm 4mm; border-right: 1pt solid #000; }
  .hdr-right { width: 38%; }
  .hdr-right table { width: 100%; border-collapse: collapse; height: 100%; }
  .hdr-right td { padding: 2mm 3mm; font-size: 8.5pt; border-bottom: 0.5pt solid #000; }
  .hdr-right td:first-child { color: #444; width: 42%; }
  .hdr-right td:last-child { font-weight: 800; }
  .hdr-right tr:last-child td { border-bottom: none; }
  .company { font-size: 13pt; font-weight: 900; margin-bottom: 2mm; }
  .hdr-detail { font-size: 8.5pt; line-height: 1.7; color: #222; }

  /* ── BILL TO ── */
  .bill-to { padding: 2.5mm 4mm; border-bottom: 1pt solid #000; }
  .bill-to .lbl { font-size: 8pt; color: #555; }
  .bill-to .name { font-size: 10pt; font-weight: 800; margin: 0.5mm 0; }
  .bill-to .addr { font-size: 8.5pt; line-height: 1.5; }

  /* ── ITEMS TABLE ── */
  table.items { width: 100%; border-collapse: collapse; }
  table.items th {
    font-size: 8pt; font-weight: 800; background: #f5f5f5;
    padding: 2mm 1.5mm; text-align: center;
    border-bottom: 1pt solid #000;
    border-left: 0.5pt solid #000;
  }
  table.items th:first-child { border-left: none; }
  table.items td {
    padding: 2mm 1.5mm; font-size: 8pt; text-align: center; vertical-align: middle;
    border-bottom: 0.5pt solid #000;
    border-left: 0.5pt solid #000;
  }
  table.items td:first-child { border-left: none; }
  table.items td.l { text-align: left; }
  table.items td.r { text-align: right; }
  .dim { font-size: 7pt; color: #555; }

  /* Spacer rows */
  table.items tr.spacer td {
    height: 7mm;
    border-bottom: 0.5pt solid #ddd;
    border-left: 0.5pt solid #000;
  }
  table.items tr.spacer td:first-child { border-left: none; }

  /* Total row */
  table.items tr.total-row td {
    font-weight: 900; font-size: 8.5pt;
    border-top: 1pt solid #000;
    border-bottom: 1pt solid #000;
    border-left: 0.5pt solid #000;
    background: #f9f9f9;
    padding: 2mm 1.5mm;
  }
  table.items tr.total-row td:first-child { border-left: none; }

  /* ── BOTTOM (amounts + words) ── */
  .bottom { display: flex; }
  .bottom-left { flex: 1; padding: 3mm 4mm; border-right: 1pt solid #000; }
  .bottom-right { width: 38%; }
  .bottom-right table { width: 100%; border-collapse: collapse; }
  .bottom-right td {
    padding: 1.5mm 3mm; font-size: 8.5pt; border-bottom: 0.5pt solid #ddd;
  }
  .bottom-right td:first-child { text-align: left; }
  .bottom-right td:last-child { text-align: right; font-weight: 600; }
  .bottom-right tr.bold td {
    font-weight: 900; font-size: 9pt;
    border-top: 1pt solid #000; border-bottom: 1pt solid #000;
  }
  .words-lbl { font-size: 8pt; color: #555; margin-bottom: 1mm; }
  .words-val { font-size: 9pt; font-weight: 700; }

  /* ── HSN TABLE ── */
  .hsn-section { border-top: 1pt solid #000; }
  table.hsn { width: 100%; border-collapse: collapse; }
  table.hsn th {
    font-size: 7.5pt; font-weight: 800; background: #f5f5f5;
    padding: 1.5mm 2mm; text-align: center;
    border-bottom: 0.5pt solid #000;
    border-left: 0.5pt solid #000;
  }
  table.hsn th:first-child { border-left: none; }
  table.hsn td {
    padding: 1.5mm 2mm; font-size: 8pt; text-align: center;
    border-bottom: 0.5pt solid #000;
    border-left: 0.5pt solid #000;
  }
  table.hsn td:first-child { border-left: none; }
  table.hsn td.r { text-align: right; }
  table.hsn td.l { text-align: left; }
  table.hsn tr.total-row td { font-weight: 900; border-top: 1pt solid #000; }
  table.hsn tr.total-row td:first-child { border-left: none; }

  /* ── FOOTER ── */
  .footer { display: flex; border-top: 1pt solid #000; }
  .footer-left {
    flex: 1; padding: 3mm 4mm; border-right: 1pt solid #000;
    font-size: 8.5pt; line-height: 1.6;
  }
  .footer-right {
    width: 38%; padding: 3mm 4mm;
    display: flex; flex-direction: column; justify-content: space-between;
    min-height: 22mm;
  }
  .footer-right .for-company { font-size: 8.5pt; text-align: right; }
  .footer-right .sig {
    font-size: 9pt; font-weight: 800; text-align: center;
    padding-top: 1.5mm; border-top: 1pt solid #000;
  }

  /* ── CONTROLS ── */
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
    body { background: #d5d5d5; padding: 20px 0 80px; }
    .inv { background: #fff; box-shadow: 0 4px 30px rgba(0,0,0,0.2); }
  }
</style>
</head>
<body>

<div class="inv">

  <div class="title">Tax Invoice</div>

  <div class="hdr">
    <div class="hdr-left">
      <div class="company">${esc(inv.seller_name).toUpperCase()}</div>
      <div class="hdr-detail">
        ${esc(inv.seller_address)}<br>
        Phone no.: 7674962758<br>
        Email: suprameds@gmail.com<br>
        GSTIN: ${esc(inv.seller_gstin)}<br>
        State: 36-${esc(inv.seller_state)}<br>
        ${dlNumbers.map((dl, i) => `Drug Licence-${20 + i}: ${esc(dl)}`).join("<br>")}
      </div>
    </div>
    <div class="hdr-right">
      <table>
        <tr><td>Invoice No.</td><td>${esc(inv.invoice_number)}</td></tr>
        <tr><td>Date</td><td>${esc(inv.invoice_date)}</td></tr>
        <tr><td>Place of supply</td><td>${inv.buyer_state ? `${esc(inv.buyer_state)}` : ""}</td></tr>
        <tr><td>Order No</td><td>${esc(extra.orderDisplayId)}</td></tr>
      </table>
    </div>
  </div>

  <div class="bill-to">
    <div class="lbl">Bill To</div>
    <div class="name">${esc(inv.buyer_name)}</div>
    <div class="addr">
      ${esc(inv.buyer_address)}
      ${extra.buyerPhone ? `<br>Contact No. : ${esc(extra.buyerPhone)}` : ""}
      ${inv.buyer_state ? `<br>State: ${esc(inv.buyer_state)}` : ""}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>#</th>
        <th>Item name</th>
        <th>Batch No.</th>
        <th>Exp. Date</th>
        <th>MRP</th>
        <th>Quantity</th>
        <th>Unit</th>
        <th>Price/ Unit</th>
        <th>Discount</th>
        <th>GST</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${spacerRows}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="4"></td>
        <td class="r"><strong>Total</strong></td>
        <td><strong>${totalQty}</strong></td>
        <td></td>
        <td></td>
        <td class="r"><strong>₹ ${inv.total_discount.toFixed(2)}</strong></td>
        <td class="r"><strong>₹ ${inv.total_gst.toFixed(2)}</strong></td>
        <td class="r"><strong>₹ ${subTotal.toFixed(2)}</strong></td>
      </tr>
    </tfoot>
  </table>

  <div class="bottom">
    <div class="bottom-left">
      <div class="words-lbl">Invoice Amount in Words</div>
      <div class="words-val">${esc(inv.amount_in_words)}</div>
    </div>
    <div class="bottom-right">
      <table>
        <tr><td><strong>Amounts</strong></td><td></td></tr>
        <tr><td>Sub Total</td><td>₹ ${subTotal.toFixed(2)}</td></tr>
        ${inv.shipping_total > 0 ? `<tr><td>Shipping</td><td>₹ ${inv.shipping_total.toFixed(2)}</td></tr>` : ''}
        <tr><td>Round off</td><td>₹ ${roundOff.toFixed(2)}</td></tr>
        <tr class="bold"><td>Total</td><td>₹ ${total.toFixed(2)}</td></tr>
        <tr><td>Received</td><td>₹ ${total.toFixed(2)}</td></tr>
        <tr><td>Balance</td><td>₹ 0.00</td></tr>
        <tr><td>You Saved</td><td>₹ ${youSaved.toFixed(2)}</td></tr>
      </table>
    </div>
  </div>

  <div class="hsn-section">
    <table class="hsn">
      <thead>
        <tr>
          <th rowspan="2">HSN/ SAC</th>
          <th rowspan="2">Taxable amount</th>
          ${inv.is_intra_state
            ? `<th colspan="2">CGST</th><th colspan="2">SGST</th>`
            : `<th colspan="2">IGST</th>`}
          <th rowspan="2">Total Tax Amount</th>
        </tr>
        <tr>
          ${inv.is_intra_state
            ? `<th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th>`
            : `<th>Rate</th><th>Amount</th>`}
        </tr>
      </thead>
      <tbody>
        ${hsnRows}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td class="l"><strong>Total</strong></td>
          <td class="r"><strong>₹ ${inv.total_taxable_value.toFixed(2)}</strong></td>
          ${inv.is_intra_state
            ? `<td></td><td class="r"><strong>₹ ${inv.total_cgst.toFixed(2)}</strong></td>
               <td></td><td class="r"><strong>₹ ${inv.total_sgst.toFixed(2)}</strong></td>`
            : `<td></td><td class="r"><strong>₹ ${inv.total_igst.toFixed(2)}</strong></td>`}
          <td class="r"><strong>₹ ${inv.total_gst.toFixed(2)}</strong></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="footer">
    <div class="footer-left">
      <strong>Terms and conditions</strong><br>
      Thanks for doing business with us!
    </div>
    <div class="footer-right">
      <div class="for-company">For : ${esc(inv.seller_name).toUpperCase()}</div>
      <div class="sig">Authorized Signatory</div>
    </div>
  </div>

</div>

<div class="controls">
  <button class="btn-print" onclick="window.print()">Print Invoice</button>
  <button class="btn-close" onclick="window.close()">Close</button>
</div>

</body>
</html>`
}
