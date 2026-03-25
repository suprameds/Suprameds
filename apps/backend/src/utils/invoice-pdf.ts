import PDFDocument from "pdfkit"
import type { GstInvoice, InvoiceLineItem } from "./gst-invoice"

/**
 * Generate a B2C retail order invoice PDF for Suprameds.
 * Includes GST breakup (required by law) but positioned as a customer-friendly
 * order invoice rather than a B2B tax invoice.
 *
 * Returns a Buffer containing the complete PDF.
 */
export async function generateInvoicePdf(
  invoice: GstInvoice
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 30,
        info: {
          Title: `Invoice ${invoice.invoice_number}`,
          Author: invoice.seller_name,
          Subject: `Order Invoice`,
        },
      })

      const chunks: Buffer[] = []
      doc.on("data", (chunk: Buffer) => chunks.push(chunk))
      doc.on("end", () => resolve(Buffer.concat(chunks)))

      const PAGE_W = 535
      const LEFT = 30
      const RIGHT = LEFT + PAGE_W

      // Reusable colors
      const NAVY = "#1E2D5A"
      const GREEN = "#27AE60"
      const GRAY = "#666666"
      const LIGHT_BG = "#F5F6FA"
      const BORDER = "#CCCCCC"
      const WHITE = "#FFFFFF"

      let y = 30

      // ── TITLE BAR ──────────────────────────────────────────────────
      doc.rect(LEFT, y, PAGE_W, 28).fill(NAVY)
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(WHITE)
        .text("Order Invoice", LEFT, y + 7, { width: PAGE_W, align: "center" })
      y += 36

      // ── SELLER INFO + INVOICE META ─────────────────────────────────
      const sellerBlockY = y
      doc.rect(LEFT, y, PAGE_W, 105).lineWidth(0.5).stroke(BORDER)

      // Left: seller details
      doc.font("Helvetica-Bold").fontSize(12).fillColor(NAVY)
      doc.text(invoice.seller_name.toUpperCase(), LEFT + 8, y + 6, {
        width: 320,
      })

      doc.font("Helvetica").fontSize(7.5).fillColor(GRAY)
      let sellerY = y + 22
      doc.text(invoice.seller_address, LEFT + 8, sellerY, { width: 320 })
      sellerY += 12
      doc.text(`GSTIN: ${invoice.seller_gstin}`, LEFT + 8, sellerY)
      sellerY += 10
      doc.text(`State: ${invoice.seller_state}`, LEFT + 8, sellerY)
      sellerY += 10
      if (invoice.seller_dl_number) {
        doc.text(
          `Drug Licence: ${invoice.seller_dl_number}`,
          LEFT + 8,
          sellerY
        )
      }

      // Right: invoice number, date, place of supply, order
      const metaX = LEFT + 340
      doc.lineWidth(0.5).moveTo(metaX, y).lineTo(metaX, y + 105).stroke(BORDER)
      // Top row
      doc.moveTo(metaX, y + 30).lineTo(RIGHT, y + 30).stroke(BORDER)
      doc.moveTo(metaX, y + 55).lineTo(RIGHT, y + 55).stroke(BORDER)
      doc.moveTo(metaX, y + 80).lineTo(RIGHT, y + 80).stroke(BORDER)
      // Vertical split
      const metaMid = metaX + 97
      doc.moveTo(metaMid, y).lineTo(metaMid, y + 105).stroke(BORDER)

      doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
      doc.text("Invoice No.", metaX + 4, y + 4)
      doc.font("Helvetica").fontSize(8).fillColor("#000")
      doc.text(invoice.invoice_number, metaX + 4, y + 16)

      doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
      doc.text("Date", metaMid + 4, y + 4)
      doc.font("Helvetica").fontSize(8).fillColor("#000")
      doc.text(invoice.invoice_date, metaMid + 4, y + 16)

      doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
      doc.text("Place of Supply", metaX + 4, y + 34)
      doc.font("Helvetica").fontSize(8).fillColor("#000")
      doc.text(invoice.place_of_supply || "—", metaX + 4, y + 46)

      doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
      doc.text("Payment", metaMid + 4, y + 34)
      doc.font("Helvetica").fontSize(8).fillColor("#000")
      const paymentLabel =
        invoice.payment_mode === "cod" ? "Cash on Delivery" :
        invoice.payment_mode === "razorpay" ? "Paid Online (Razorpay)" :
        invoice.payment_mode === "online" ? "Paid Online" :
        invoice.payment_mode.toUpperCase()
      doc.text(paymentLabel, metaMid + 4, y + 46)

      if (invoice.prescription_ref) {
        doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
        doc.text("Prescription Ref", metaX + 4, y + 59)
        doc.font("Helvetica").fontSize(7).fillColor("#000")
        doc.text(invoice.prescription_ref, metaX + 4, y + 71)
      }

      if (invoice.supply_memo_number) {
        doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
        doc.text("Memo No.", metaMid + 4, y + 59)
        doc.font("Helvetica").fontSize(7).fillColor("#000")
        doc.text(invoice.supply_memo_number, metaMid + 4, y + 71)
      }

      y = sellerBlockY + 113

      // ── SHIP TO / BILL TO ──────────────────────────────────────────
      doc.rect(LEFT, y, PAGE_W, 50).lineWidth(0.5).stroke(BORDER)
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(NAVY)
      doc.text("Deliver To", LEFT + 8, y + 4)
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000")
      doc.text(invoice.buyer_name || "Customer", LEFT + 8, y + 15)
      doc.font("Helvetica").fontSize(7.5).fillColor(GRAY)
      doc.text(invoice.buyer_address, LEFT + 8, y + 27, { width: 400 })
      if (invoice.buyer_state) {
        doc.text(`State: ${invoice.buyer_state}`, LEFT + 8, y + 39)
      }

      y += 58

      // ── ITEMS TABLE ────────────────────────────────────────────────
      const cols = buildColumnLayout(invoice.is_intra_state)

      // Header row
      doc.rect(LEFT, y, PAGE_W, 22).fill(NAVY)
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(WHITE)
      for (const col of cols) {
        doc.text(col.header, col.x, y + 5, {
          width: col.w,
          align: col.align as any,
        })
      }
      y += 22

      // Data rows
      let totalQty = 0
      let totalDiscountDisplay = 0
      let totalGstDisplay = 0
      let totalAmountDisplay = 0

      for (let i = 0; i < invoice.items.length; i++) {
        const item = invoice.items[i]
        const rowH = 28
        const bgColor = i % 2 === 0 ? WHITE : LIGHT_BG
        doc.rect(LEFT, y, PAGE_W, rowH).fill(bgColor)
        doc.rect(LEFT, y, PAGE_W, rowH).lineWidth(0.3).stroke(BORDER)

        doc.font("Helvetica").fontSize(6.5).fillColor("#000")

        const discountPct = item.unit_mrp > 0
          ? Math.round(((item.unit_mrp - item.unit_selling_price) / item.unit_mrp) * 100)
          : 0
        const gstAmt = item.cgst_amount + item.sgst_amount + item.igst_amount

        const values = buildRowValues(item, i + 1, discountPct, gstAmt, invoice.is_intra_state)

        for (let c = 0; c < cols.length; c++) {
          const col = cols[c]
          const val = values[c]
          if (col.header === "Item Name") {
            doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#000")
            doc.text(val, col.x, y + 4, { width: col.w })
            if (item.generic_name && item.generic_name !== item.product_title) {
              doc.font("Helvetica").fontSize(5.5).fillColor(GRAY)
              doc.text(item.generic_name, col.x, y + 16, { width: col.w })
            }
            doc.font("Helvetica").fontSize(6.5).fillColor("#000")
          } else {
            doc.text(val, col.x, y + 10, {
              width: col.w,
              align: col.align as any,
            })
          }
        }

        totalQty += item.quantity
        totalDiscountDisplay += item.discount_amount
        totalGstDisplay += gstAmt
        totalAmountDisplay += item.line_total

        y += rowH
      }

      // Totals row
      doc.rect(LEFT, y, PAGE_W, 18).fill(NAVY)
      doc.font("Helvetica-Bold").fontSize(7).fillColor(WHITE)
      doc.text("Total", LEFT + 4, y + 5)
      doc.text(String(totalQty), cols[5].x, y + 5, { width: cols[5].w, align: "center" })
      doc.text(`₹${fmtNum(totalDiscountDisplay)}`, cols[8].x, y + 5, { width: cols[8].w, align: "right" })
      doc.text(`₹${fmtNum(totalGstDisplay)}`, cols[9].x, y + 5, { width: cols[9].w, align: "right" })
      doc.text(`₹${fmtNum(totalAmountDisplay)}`, cols[10].x, y + 5, { width: cols[10].w, align: "right" })
      y += 26

      // ── AMOUNT IN WORDS + AMOUNTS SUMMARY ──────────────────────────
      doc.rect(LEFT, y, PAGE_W, 100).lineWidth(0.5).stroke(BORDER)

      // Left: Amount in words + You Saved
      doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
      doc.text("Amount in Words", LEFT + 8, y + 6)
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000")
      doc.text(invoice.amount_in_words, LEFT + 8, y + 18, { width: 250 })

      if (invoice.total_discount > 0) {
        doc.font("Helvetica-Bold").fontSize(8).fillColor(GREEN)
        doc.text(
          `You Saved: ₹${fmtNum(invoice.total_discount)}`,
          LEFT + 8,
          y + 45
        )
      }

      // Right: amounts table
      const amtX = LEFT + 280
      doc.lineWidth(0.3).moveTo(amtX, y).lineTo(amtX, y + 100).stroke(BORDER)

      const amtRows: [string, string][] = [
        ["Sub Total (MRP)", `₹${fmtNum(invoice.subtotal)}`],
        [
          `Discount (${invoice.subtotal > 0 ? ((invoice.total_discount / invoice.subtotal) * 100).toFixed(1) : "0"}%)`,
          `₹${fmtNum(invoice.total_discount)}`,
        ],
      ]

      amtRows.push(["Tax (GST)", `₹${fmtNum(invoice.total_gst)}`])

      const roundOff = Math.round(invoice.grand_total) - invoice.grand_total
      if (Math.abs(roundOff) >= 0.01) {
        amtRows.push(["Round Off", `₹${roundOff > 0 ? "+" : ""}${roundOff.toFixed(2)}`])
      }

      amtRows.push(["Total", `₹${fmtNum(Math.round(invoice.grand_total))}`])

      let amtY = y + 6
      for (const [label, value] of amtRows) {
        const isTotalRow = label === "Total"
        doc
          .font(isTotalRow ? "Helvetica-Bold" : "Helvetica")
          .fontSize(isTotalRow ? 9 : 7.5)
          .fillColor(isTotalRow ? NAVY : "#000")
        doc.text(label, amtX + 6, amtY, { width: 120 })
        doc.text(value, amtX + 130, amtY, {
          width: 110,
          align: "right",
        })
        amtY += isTotalRow ? 14 : 11
      }

      y += 108

      // ── GST SUMMARY TABLE ──────────────────────────────────────────
      const hsnGroups = groupByHsn(invoice.items, invoice.is_intra_state)

      doc.rect(LEFT, y, PAGE_W, 16).fill(NAVY)
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(WHITE)

      const gstCols = invoice.is_intra_state
        ? [
            { header: "HSN/SAC", x: LEFT + 4, w: 70 },
            { header: "Taxable Amount", x: LEFT + 80, w: 90 },
            { header: "CGST Rate", x: LEFT + 175, w: 55 },
            { header: "CGST Amt", x: LEFT + 235, w: 65 },
            { header: "SGST Rate", x: LEFT + 305, w: 55 },
            { header: "SGST Amt", x: LEFT + 365, w: 65 },
            { header: "Total Tax", x: LEFT + 435, w: 96 },
          ]
        : [
            { header: "HSN/SAC", x: LEFT + 4, w: 100 },
            { header: "Taxable Amount", x: LEFT + 110, w: 110 },
            { header: "IGST Rate", x: LEFT + 225, w: 80 },
            { header: "IGST Amount", x: LEFT + 310, w: 100 },
            { header: "Total Tax Amount", x: LEFT + 415, w: 116 },
          ]

      for (const col of gstCols) {
        doc.text(col.header, col.x, y + 4, { width: col.w, align: "center" })
      }
      y += 16

      let taxTotal = 0
      let taxableTotal = 0

      for (const grp of hsnGroups) {
        doc.rect(LEFT, y, PAGE_W, 14).lineWidth(0.3).stroke(BORDER)
        doc.font("Helvetica").fontSize(7).fillColor("#000")

        if (invoice.is_intra_state) {
          doc.text(grp.hsn, gstCols[0].x, y + 3, { width: gstCols[0].w })
          doc.text(`₹${fmtNum(grp.taxable)}`, gstCols[1].x, y + 3, { width: gstCols[1].w, align: "right" })
          doc.text(`${grp.rate / 2}%`, gstCols[2].x, y + 3, { width: gstCols[2].w, align: "center" })
          doc.text(`₹${fmtNum(grp.cgst)}`, gstCols[3].x, y + 3, { width: gstCols[3].w, align: "right" })
          doc.text(`${grp.rate / 2}%`, gstCols[4].x, y + 3, { width: gstCols[4].w, align: "center" })
          doc.text(`₹${fmtNum(grp.sgst)}`, gstCols[5].x, y + 3, { width: gstCols[5].w, align: "right" })
          doc.text(`₹${fmtNum(grp.totalTax)}`, gstCols[6].x, y + 3, { width: gstCols[6].w, align: "right" })
        } else {
          doc.text(grp.hsn, gstCols[0].x, y + 3, { width: gstCols[0].w })
          doc.text(`₹${fmtNum(grp.taxable)}`, gstCols[1].x, y + 3, { width: gstCols[1].w, align: "right" })
          doc.text(`${grp.rate}%`, gstCols[2].x, y + 3, { width: gstCols[2].w, align: "center" })
          doc.text(`₹${fmtNum(grp.igst)}`, gstCols[3].x, y + 3, { width: gstCols[3].w, align: "right" })
          doc.text(`₹${fmtNum(grp.totalTax)}`, gstCols[4].x, y + 3, { width: gstCols[4].w, align: "right" })
        }

        taxTotal += grp.totalTax
        taxableTotal += grp.taxable
        y += 14
      }

      // GST summary totals row
      doc.rect(LEFT, y, PAGE_W, 14).fill(LIGHT_BG)
      doc.rect(LEFT, y, PAGE_W, 14).lineWidth(0.3).stroke(BORDER)
      doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
      doc.text("Total", gstCols[0].x, y + 3, { width: gstCols[0].w })
      doc.text(`₹${fmtNum(taxableTotal)}`, gstCols[1].x, y + 3, { width: gstCols[1].w, align: "right" })

      const lastGstCol = gstCols[gstCols.length - 1]
      doc.text(`₹${fmtNum(taxTotal)}`, lastGstCol.x, y + 3, { width: lastGstCol.w, align: "right" })
      y += 22

      // ── FOOTER: Terms + Authorized Signatory ───────────────────────
      doc.rect(LEFT, y, PAGE_W, 60).lineWidth(0.5).stroke(BORDER)
      doc.lineWidth(0.3).moveTo(LEFT + PAGE_W / 2, y).lineTo(LEFT + PAGE_W / 2, y + 60).stroke(BORDER)

      doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
      doc.text("Terms and Conditions", LEFT + 8, y + 6)
      doc.font("Helvetica").fontSize(6.5).fillColor(GRAY)
      doc.text("1. Goods once sold will not be taken back.", LEFT + 8, y + 18)
      doc.text("2. Subject to Hyderabad jurisdiction.", LEFT + 8, y + 28)
      doc.text("3. E. & O. E.", LEFT + 8, y + 38)

      doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
      doc.text(`For: ${invoice.seller_name.toUpperCase()}`, LEFT + PAGE_W / 2 + 10, y + 6)
      doc.font("Helvetica").fontSize(7).fillColor(GRAY)
      doc.text("Authorized Signatory", LEFT + PAGE_W / 2 + 10, y + 46)

      y += 68

      // ── POWERED BY ─────────────────────────────────────────────────
      doc.font("Helvetica").fontSize(6).fillColor(GRAY)
      doc.text(
        "This is a computer-generated document and does not require a physical signature.",
        LEFT,
        y,
        { width: PAGE_W, align: "center" }
      )

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type ColDef = { header: string; x: number; w: number; align: string }

function buildColumnLayout(intraState: boolean): ColDef[] {
  const L = 30
  return [
    { header: "#", x: L + 2, w: 16, align: "center" },
    { header: "Item Name", x: L + 18, w: 105, align: "left" },
    { header: "Batch", x: L + 125, w: 48, align: "center" },
    { header: "Exp.", x: L + 175, w: 48, align: "center" },
    { header: "MRP", x: L + 225, w: 42, align: "right" },
    { header: "Qty", x: L + 269, w: 26, align: "center" },
    { header: "Unit", x: L + 297, w: 20, align: "center" },
    { header: "Rate", x: L + 319, w: 42, align: "right" },
    { header: "Discount", x: L + 363, w: 54, align: "right" },
    { header: "Tax", x: L + 419, w: 50, align: "right" },
    { header: "Amount", x: L + 471, w: 62, align: "right" },
  ]
}

function buildRowValues(
  item: InvoiceLineItem,
  rowNum: number,
  discountPct: number,
  gstAmt: number,
  intraState: boolean
): string[] {
  return [
    String(rowNum),
    item.product_title,
    item.batch_number,
    item.expiry_date,
    `₹${fmtNum(item.unit_mrp)}`,
    String(item.quantity),
    "St",
    `₹${fmtNum(item.unit_selling_price)}`,
    `₹${fmtNum(item.discount_amount)}\n(${discountPct}%)`,
    `₹${fmtNum(gstAmt)}\n(${item.gst_rate}%)`,
    `₹${fmtNum(item.line_total)}`,
  ]
}

interface HsnGroup {
  hsn: string
  rate: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  totalTax: number
}

function groupByHsn(items: InvoiceLineItem[], intraState: boolean): HsnGroup[] {
  const map = new Map<string, HsnGroup>()

  for (const item of items) {
    const key = `${item.hsn_code || "N/A"}_${item.gst_rate}`
    const existing = map.get(key)

    if (existing) {
      existing.taxable += item.taxable_value
      existing.cgst += item.cgst_amount
      existing.sgst += item.sgst_amount
      existing.igst += item.igst_amount
      existing.totalTax += item.cgst_amount + item.sgst_amount + item.igst_amount
    } else {
      map.set(key, {
        hsn: item.hsn_code || "N/A",
        rate: item.gst_rate,
        taxable: item.taxable_value,
        cgst: item.cgst_amount,
        sgst: item.sgst_amount,
        igst: item.igst_amount,
        totalTax: item.cgst_amount + item.sgst_amount + item.igst_amount,
      })
    }
  }

  return Array.from(map.values())
}
