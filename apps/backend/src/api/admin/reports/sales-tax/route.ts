import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { isIntraState } from "../../../../utils/gst-invoice"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("admin:reports:sales-tax")

/**
 * GET /admin/reports/sales-tax
 * Generates a GST sales tax report for a given period.
 * Query params: from (ISO date), to (ISO date)
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderService = req.scope.resolve(Modules.ORDER) as any

    const from = (req.query.from as string) || getFirstOfMonth()
    const to = (req.query.to as string) || new Date().toISOString()

    const orders = await orderService.listOrders(
      {
        status: "completed",
        created_at: {
          $gte: from,
          $lte: to,
        },
      },
      {
        take: null,
        relations: ["items", "shipping_address"],
      }
    )

    const report = buildTaxReport(orders || [], from, to)
    res.json(report)
  } catch (err) {
    logger.error(`GET failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to generate sales tax report" })
  }
}

/**
 * POST /admin/reports/sales-tax
 * Same as GET but accepts body params. Useful for complex filter payloads.
 * Body: { from, to, include_cancelled? }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderService = req.scope.resolve(Modules.ORDER) as any
    const body = req.body as Record<string, any>

    const from = body.from || getFirstOfMonth()
    const to = body.to || new Date().toISOString()
    const statuses = body.include_cancelled
      ? ["completed", "canceled"]
      : ["completed"]

    const orders = await orderService.listOrders(
      {
        status: statuses,
        created_at: {
          $gte: from,
          $lte: to,
        },
      },
      {
        take: null,
        relations: ["items", "shipping_address"],
      }
    )

    const report = buildTaxReport(orders || [], from, to)
    res.json(report)
  } catch (err) {
    logger.error(`POST failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to generate sales tax report" })
  }
}

function getFirstOfMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function buildTaxReport(orders: any[], from: string, to: string) {
  const sellerState = process.env.WAREHOUSE_STATE || "Telangana"
  const gstSlabs: Record<string, { items: number; taxable_value: number; cgst: number; sgst: number; igst: number }> = {
    "0": { items: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0 },
    "5": { items: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0 },
    "12": { items: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0 },
    "18": { items: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0 },
  }

  let totalRevenue = 0
  let totalTax = 0

  for (const order of orders) {
    totalRevenue += Number(order.total) || 0
    totalTax += Number(order.tax_total) || 0

    const buyerState =
      order.shipping_address?.province || order.shipping_address?.state || ""
    const intraState = isIntraState(sellerState, buyerState)

    for (const item of order.items || []) {
      const rate = String(item.metadata?.gst_rate ?? 5)
      if (!gstSlabs[rate]) {
        gstSlabs[rate] = { items: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0 }
      }

      const lineTotal = (item.unit_price ?? 0) * (item.quantity ?? 1)
      const lineTax = Number(item.tax_total) || 0

      gstSlabs[rate].items += item.quantity ?? 1
      gstSlabs[rate].taxable_value += lineTotal

      if (intraState) {
        gstSlabs[rate].cgst += lineTax / 2
        gstSlabs[rate].sgst += lineTax / 2
      } else {
        gstSlabs[rate].igst += lineTax
      }
    }
  }

  return {
    period: { from, to },
    summary: {
      total_orders: orders.length,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_tax_collected: Math.round(totalTax * 100) / 100,
    },
    gst_breakdown: gstSlabs,
    generated_at: new Date().toISOString(),
  }
}
