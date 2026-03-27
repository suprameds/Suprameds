import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { WAREHOUSE_MODULE } from "../../../../../modules/warehouse"
import { INVENTORY_BATCH_MODULE } from "../../../../../modules/inventoryBatch"

/**
 * GET /admin/warehouse/pick-lists/print?order_id=xxx
 * Returns a printable HTML pick list for a given order.
 * Queries pick list lines for the order and renders them as an HTML table.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { order_id } = req.query as Record<string, string>

  if (!order_id) {
    return res.status(400).json({ error: "order_id query param is required" })
  }

  try {
    const warehouseService = req.scope.resolve(WAREHOUSE_MODULE) as any
    const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
    const orderService = req.scope.resolve(Modules.ORDER) as any

    // Fetch pick list lines for this order via the warehouse task → pick list lines
    // PickListLine has task_id, so we need to look up the task by order context.
    // Fetch all tasks for the order, then lines for those tasks.
    const tasks = await warehouseService.listWarehouseTasks(
      { metadata: { order_id } } as Record<string, any>,
      { take: 50 }
    )
    const taskList: any[] = Array.isArray(tasks?.[0])
      ? tasks[0]
      : Array.isArray(tasks)
      ? tasks
      : []

    const taskIds = taskList.map((t: any) => t.id).filter(Boolean)

    // Also try querying pick list lines directly by order_item_id pattern
    // (fallback: list all lines if task lookup yields nothing, filtered by task_ids)
    let pickLines: any[] = []

    if (taskIds.length > 0) {
      const rawLines = await warehouseService.listPickListLines(
        { task_id: taskIds },
        {
          take: 100,
          order: { bin_id: "ASC" },
        }
      )
      pickLines = Array.isArray(rawLines?.[0])
        ? rawLines[0]
        : Array.isArray(rawLines)
        ? rawLines
        : []
    }

    // Fetch order metadata for the header
    let orderDisplay: any = null
    try {
      orderDisplay = await orderService.retrieveOrder(order_id, {
        relations: ["shipping_address", "items"],
      })
    } catch {
      // Non-fatal — render with just order_id in header
    }

    // Enrich pick lines with batch and bin info
    const enrichedLines: Array<{
      product_name: string
      batch_number: string
      bin_location: string
      qty_to_pick: number
    }> = []

    for (const line of pickLines) {
      let batchNumber = line.batch_id ?? "—"
      let binLocation = line.bin_id ?? "—"

      // Look up batch lot number
      try {
        const batch = await batchService.retrieveBatch(line.batch_id)
        batchNumber = batch?.lot_number ?? line.batch_id
      } catch {
        // keep batch_id as fallback
      }

      // Look up bin code
      try {
        const bin = await warehouseService.retrieveWarehouseBin(line.bin_id)
        binLocation = bin?.bin_code ?? line.bin_id
      } catch {
        // keep bin_id as fallback
      }

      // Try to get product name from order items
      let productName = line.order_item_id ?? "Unknown Product"
      if (orderDisplay) {
        const matchItem = (orderDisplay.items ?? []).find(
          (i: any) => i.id === line.order_item_id
        )
        if (matchItem?.title) productName = matchItem.title
      }

      enrichedLines.push({
        product_name: productName,
        batch_number: batchNumber,
        bin_location: binLocation,
        qty_to_pick: line.quantity_to_pick ?? 0,
      })
    }

    // Build customer/shipping info for the header
    const customerName = orderDisplay
      ? `${orderDisplay.shipping_address?.first_name ?? ""} ${orderDisplay.shipping_address?.last_name ?? ""}`.trim()
      : "—"
    const displayId = orderDisplay?.display_id ?? order_id
    const printDate = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })

    // Render rows
    const rowsHtml =
      enrichedLines.length > 0
        ? enrichedLines
            .map(
              (line, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(line.product_name)}</td>
          <td>${escapeHtml(line.batch_number)}</td>
          <td>${escapeHtml(line.bin_location)}</td>
          <td style="text-align:center">${line.qty_to_pick}</td>
          <td style="width:150px">&nbsp;</td>
        </tr>`
            )
            .join("")
        : `<tr><td colspan="6" style="text-align:center;color:#888">No pick lines found for this order</td></tr>`

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pick List — Order #${escapeHtml(String(displayId))}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; margin: 24px; color: #111; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { margin-bottom: 16px; color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #2c3e50; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; }
    td { padding: 7px 10px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f9f9f9; }
    .footer { margin-top: 32px; display: flex; justify-content: space-between; }
    .sig-box { border-top: 1px solid #333; width: 220px; padding-top: 4px; font-size: 11px; color: #555; text-align: center; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Suprameds — Warehouse Pick List</h1>
  <div class="meta">
    <strong>Order:</strong> #${escapeHtml(String(displayId))} &nbsp;|&nbsp;
    <strong>Customer:</strong> ${escapeHtml(customerName)} &nbsp;|&nbsp;
    <strong>Printed:</strong> ${escapeHtml(printDate)}
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Product Name</th>
        <th>Batch #</th>
        <th>Bin Location</th>
        <th>Qty to Pick</th>
        <th>Pharmacist Signature</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div class="sig-box">Picked by (Warehouse Staff)<br /><br />Name: ________________</div>
    <div class="sig-box">Verified by (Pharmacist)<br /><br />Reg. No: ______________</div>
    <div class="sig-box">Dispatched by<br /><br />Date: _________________</div>
  </div>
</body>
</html>`

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    return res.status(200).send(html)
  } catch (err: any) {
    console.error("[admin:warehouse:pick-lists:print] GET failed:", err?.message)
    return res.status(500).json({ error: "Failed to generate print pick list" })
  }
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
