import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRESCRIPTION_MODULE } from "../../../../modules/prescription"
import { PHARMA_MODULE } from "../../../../modules/pharma"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("admin:pharmacist:rx-queue")

/**
 * GET /admin/pharmacist/rx-queue
 * Returns prescriptions pending review, sorted by urgency:
 *   - Schedule H1 prescriptions first (controlled substances)
 *   - Then all others, both groups sorted by created_at ASC (oldest first)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any
    const pharmaService = req.scope.resolve(PHARMA_MODULE) as any

    // 1. Fetch all pending-review prescriptions with their line items
    const rawPrescriptions = await prescriptionService.listPrescriptions(
      { status: "pending_review" },
      { order: { created_at: "ASC" }, relations: ["lines"] }
    )

    const prescriptions: any[] = Array.isArray(rawPrescriptions?.[0])
      ? rawPrescriptions[0]
      : Array.isArray(rawPrescriptions)
      ? rawPrescriptions
      : []

    if (prescriptions.length === 0) {
      return res.json({ data: [], count: 0 })
    }

    // 2. Collect unique product_ids from prescription lines
    const productIds = new Set<string>()
    for (const rx of prescriptions) {
      for (const line of rx.lines ?? []) {
        if (line.product_id) productIds.add(line.product_id)
      }
    }

    // 3. Query drug info to find Schedule H1 products
    let h1ProductIds = new Set<string>()
    if (productIds.size > 0) {
      try {
        const drugs = await pharmaService.listDrugProducts(
          { product_id: Array.from(productIds) },
          {}
        )
        const drugList: any[] = Array.isArray(drugs?.[0])
          ? drugs[0]
          : Array.isArray(drugs)
          ? drugs
          : []

        for (const drug of drugList) {
          if (drug.schedule === "H1" && drug.product_id) {
            h1ProductIds.add(drug.product_id)
          }
        }
      } catch (err: any) {
        // Non-fatal: if drug lookup fails, fall back to no H1 prioritisation
        logger.warn("Drug schedule lookup failed:", err?.message)
      }
    }

    // 4. Tag each prescription with H1 flag
    const tagged = prescriptions.map((rx) => {
      const isH1 = (rx.lines ?? []).some((line: any) =>
        line.product_id ? h1ProductIds.has(line.product_id) : false
      )
      return { ...rx, _is_h1: isH1 }
    })

    // 5. Sort: H1 first, then by created_at ASC (already sorted from query, maintain order)
    const sorted = tagged.sort((a, b) => {
      if (a._is_h1 && !b._is_h1) return -1
      if (!a._is_h1 && b._is_h1) return 1
      // Secondary: created_at ASC
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    // Strip internal flag before returning
    const data = sorted.map(({ _is_h1, ...rx }) => rx)

    return res.json({ data, count: data.length })
  } catch (err: any) {
    logger.error("GET failed:", err?.message)
    return res.status(500).json({ error: "Failed to fetch prescription queue" })
  }
}
