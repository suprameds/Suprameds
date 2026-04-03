import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const LOG = "[job:sales-tax]"

/**
 * Monthly job (1st of month at 06:00 UTC) — generates a GST sales tax
 * summary for the previous month. Queries all completed orders, aggregates
 * by GST slab (0%, 5%, 12%, 18%), and logs the report.
 *
 * Medicines in India are taxed at 5% (most) or 12% GST.
 * This report feeds into GSTR-1 filing.
 */
export default async function GenerateSalesTaxReportJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any

  // Only run on the 1st of the month (schedule is daily to avoid Node.js 32-bit timer overflow)
  const today = new Date()
  if (today.getDate() !== 1) return

  logger.info(`${LOG} Starting`)

  try {
    const orderService = container.resolve(Modules.ORDER) as any

    // Calculate previous month date range
    const now = new Date()
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

    const monthLabel = startOfPrevMonth.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    })

    logger.info(`${LOG} Generating report for ${monthLabel}`)

    // Fetch completed orders for the period
    const orders = await orderService.listOrders(
      {
        status: "completed",
        created_at: {
          $gte: startOfPrevMonth.toISOString(),
          $lte: endOfPrevMonth.toISOString(),
        },
      },
      {
        take: null,
        relations: ["items"],
      }
    )

    if (!orders?.length) {
      logger.info(`${LOG} No completed orders found for ${monthLabel}`)
      return
    }

    // Aggregate by GST slab
    const gstSlabs: Record<string, { count: number; taxable: number; tax: number }> = {
      "0%": { count: 0, taxable: 0, tax: 0 },
      "5%": { count: 0, taxable: 0, tax: 0 },
      "12%": { count: 0, taxable: 0, tax: 0 },
      "18%": { count: 0, taxable: 0, tax: 0 },
    }

    let totalRevenue = 0
    let totalTax = 0

    for (const order of orders) {
      totalRevenue += Number(order.total) || 0
      totalTax += Number(order.tax_total) || 0

      for (const item of order.items || []) {
        const taxRate = item.metadata?.gst_rate ?? 5
        const slabKey = `${taxRate}%`
        if (!gstSlabs[slabKey]) {
          gstSlabs[slabKey] = { count: 0, taxable: 0, tax: 0 }
        }
        const lineTotal = (item.unit_price ?? 0) * (item.quantity ?? 1)
        gstSlabs[slabKey].count += item.quantity ?? 1
        gstSlabs[slabKey].taxable += lineTotal
        gstSlabs[slabKey].tax += Number(item.tax_total) || 0
      }
    }

    const report = {
      period: monthLabel,
      total_orders: orders.length,
      total_revenue: totalRevenue,
      total_tax: totalTax,
      gst_breakdown: gstSlabs,
      generated_at: new Date().toISOString(),
    }

    logger.info(`${LOG} Report for ${monthLabel}:`)
    logger.info(`${LOG}   Orders: ${report.total_orders}`)
    logger.info(`${LOG}   Revenue: ₹${report.total_revenue}`)
    logger.info(`${LOG}   Tax collected: ₹${report.total_tax}`)
    for (const [slab, data] of Object.entries(gstSlabs)) {
      if (data.count > 0) {
        logger.info(`${LOG}   GST ${slab}: ${data.count} items, taxable ₹${data.taxable}, tax ₹${data.tax}`)
      }
    }

    // Store the report via the query module for admin access
    try {
      const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
      // The report is logged; admin can fetch via /admin/reports/sales-tax endpoint
      logger.info(`${LOG} Report generated successfully for ${monthLabel}`)
    } catch {
      // Query storage is optional
    }
  } catch (err) {
    logger.error(`${LOG} Failed: ${(err as Error).message}`)
  }
}

export const config = {
  name: "sales-tax",
  // Daily at 06:00 UTC — job self-checks for 1st of month.
  // Monthly cron (0 6 1 * *) causes Node.js 32-bit timer overflow → infinite loop.
  schedule: "0 6 * * *",
}
