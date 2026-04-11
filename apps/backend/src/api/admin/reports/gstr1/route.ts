import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadGstr1Data, Gstr1Report } from "../../../../utils/gst-invoice"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("admin:reports:gstr1")

/**
 * GET /admin/reports/gstr1
 * Generate GSTR-1 report for a given month/year.
 * Query params: month (1-12), year (YYYY), format (json|csv)
 *
 * B2C only — classifies into B2C Small, B2C Large, HSN Summary, Nil-rated.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const month = parseInt(req.query.month as string)
    const year = parseInt(req.query.year as string)
    const format = (req.query.format as string) ?? "json"

    if (!month || !year || month < 1 || month > 12 || year < 2020) {
      res.status(400).json({
        error: "Invalid params. Required: month (1-12), year (YYYY)",
      })
      return
    }

    const report = await loadGstr1Data(req.scope, { month, year })

    if (format === "csv") {
      const csv = gstr1ToCsv(report)
      res.setHeader("Content-Type", "text/csv")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="GSTR1-${report.period}.csv"`
      )
      res.send(csv)
      return
    }

    // Default: JSON (government GSTR-1 compatible structure)
    res.json({
      ...report,
      // Flatten for government JSON compatibility
      government_format: toGovernmentJson(report),
    })
  } catch (err) {
    logger.error(`GET failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to generate GSTR-1 report" })
  }
}

/**
 * Convert GSTR-1 report to government JSON format.
 * Ref: GSTN Offline Tool schema
 */
function toGovernmentJson(report: Gstr1Report) {
  return {
    gstin: report.gstin,
    fp: report.period.replace("-", ""),
    // B2C Small — Table 7
    b2cs: groupB2cSmall(report.b2c_small),
    // B2C Large — Table 5
    b2cl: groupB2cLarge(report.b2c_large),
    // HSN Summary — Table 12
    hsn: {
      data: report.hsn_summary.map((h) => ({
        hsn_sc: h.hsn_code,
        rt: h.gst_rate,
        qty: h.quantity,
        txval: h.taxable_value,
        camt: h.cgst,
        samt: h.sgst,
        iamt: h.igst,
      })),
    },
    // Nil-rated — Table 8
    nil: {
      inv: [
        {
          sply_ty: "INTRB2C",
          nil_amt: report.nil_rated
            .filter((i) => i.is_intra_state)
            .reduce((s, i) => s + i.line_total, 0),
          expt_amt: 0,
          ngsup_amt: 0,
        },
        {
          sply_ty: "INTRAB2C",
          nil_amt: report.nil_rated
            .filter((i) => !i.is_intra_state)
            .reduce((s, i) => s + i.line_total, 0),
          expt_amt: 0,
          ngsup_amt: 0,
        },
      ],
    },
  }
}

function groupB2cSmall(items: Gstr1Report["b2c_small"]) {
  // Group by place of supply + rate
  const groups = new Map<string, { pos: string; rt: number; txval: number; camt: number; samt: number }>()
  for (const item of items) {
    const key = `${item.place_of_supply_code ?? "36"}:${item.gst_rate}`
    const existing = groups.get(key)
    if (existing) {
      existing.txval += item.taxable_value
      existing.camt += item.cgst
      existing.samt += item.sgst
    } else {
      groups.set(key, {
        pos: item.place_of_supply_code ?? "36",
        rt: item.gst_rate,
        txval: item.taxable_value,
        camt: item.cgst,
        samt: item.sgst,
      })
    }
  }
  return Array.from(groups.values()).map((g) => ({
    ...g,
    txval: Math.round(g.txval * 100) / 100,
    camt: Math.round(g.camt * 100) / 100,
    samt: Math.round(g.samt * 100) / 100,
    typ: "OE",
  }))
}

function groupB2cLarge(items: Gstr1Report["b2c_large"]) {
  // Group by place of supply, then by invoice
  const posByInvoice = new Map<string, Map<string, { inum: string; idt: string; val: number; items: any[] }>>()

  for (const item of items) {
    const pos = item.place_of_supply_code ?? "36"
    if (!posByInvoice.has(pos)) posByInvoice.set(pos, new Map())
    const invoices = posByInvoice.get(pos)!
    const inv = invoices.get(item.invoice_number)
    if (inv) {
      inv.val += item.line_total
      inv.items.push({
        rt: item.gst_rate,
        txval: item.taxable_value,
        iamt: item.igst,
      })
    } else {
      invoices.set(item.invoice_number, {
        inum: item.invoice_number,
        idt: item.invoice_date,
        val: item.line_total,
        items: [{
          rt: item.gst_rate,
          txval: item.taxable_value,
          iamt: item.igst,
        }],
      })
    }
  }

  return Array.from(posByInvoice.entries()).map(([pos, invoices]) => ({
    pos,
    inv: Array.from(invoices.values()).map((inv) => ({
      inum: inv.inum,
      idt: inv.idt,
      val: Math.round(inv.val * 100) / 100,
      itms: inv.items,
    })),
  }))
}

/**
 * Convert report to CSV format — one row per line item.
 */
function gstr1ToCsv(report: Gstr1Report): string {
  const headers = [
    "Section",
    "Order ID",
    "Invoice Number",
    "Invoice Date",
    "Place of Supply",
    "State Code",
    "HSN Code",
    "GST Rate",
    "Taxable Value",
    "CGST",
    "SGST",
    "IGST",
    "Total",
    "Product",
  ]

  const rows: string[][] = []

  const addItems = (section: string, items: Gstr1Report["b2c_small"]) => {
    for (const item of items) {
      rows.push([
        section,
        String(item.display_id),
        item.invoice_number,
        item.invoice_date,
        item.place_of_supply,
        item.place_of_supply_code ?? "",
        item.hsn_code,
        String(item.gst_rate),
        String(item.taxable_value),
        String(item.cgst),
        String(item.sgst),
        String(item.igst),
        String(item.line_total),
        item.product_title,
      ])
    }
  }

  addItems("B2C Small", report.b2c_small)
  addItems("B2C Large", report.b2c_large)
  addItems("Nil Rated", report.nil_rated)

  // HSN summary rows
  rows.push([])
  rows.push(["HSN Summary", "HSN Code", "GST Rate", "Quantity", "Taxable Value", "CGST", "SGST", "IGST", "Total", "", "", "", "", ""])
  for (const hsn of report.hsn_summary) {
    rows.push([
      "",
      hsn.hsn_code,
      String(hsn.gst_rate),
      String(hsn.quantity),
      String(hsn.taxable_value),
      String(hsn.cgst),
      String(hsn.sgst),
      String(hsn.igst),
      String(hsn.total),
      "", "", "", "", "",
    ])
  }

  // Validation issues
  if (report.validation.length > 0) {
    rows.push([])
    rows.push(["Validation Issues", "Order ID", "Field", "Message", "Severity", "", "", "", "", "", "", "", "", ""])
    for (const v of report.validation) {
      rows.push(["", v.order_id, v.field, v.message, v.severity, "", "", "", "", "", "", "", "", ""])
    }
  }

  const escapeCsv = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`
    }
    return val
  }

  return [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n")
}
