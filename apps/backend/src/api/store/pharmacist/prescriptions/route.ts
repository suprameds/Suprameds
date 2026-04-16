import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRESCRIPTION_MODULE } from "../../../../modules/prescription"
import { PHARMA_MODULE } from "../../../../modules/pharma"
import { decryptPhiArray, PRESCRIPTION_PHI_FIELDS, isPhiEncryptionEnabled } from "../../../../lib/phi-crypto"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("store:pharmacist:prescriptions")

/**
 * GET /store/pharmacist/prescriptions
 * Pharmacist: list prescriptions with optional status filter.
 * Pending prescriptions are sorted by urgency (H1 first, then oldest first).
 * Query: ?status=pending_review|approved|rejected|expired|used
 *        ?customer_id=cus_xxx (filter by customer)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const status = req.query.status as string | undefined
  const customerId = req.query.customer_id as string | undefined

  try {
    const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any
    const pharmaService = req.scope.resolve(PHARMA_MODULE) as any

    const filters: Record<string, any> = {}
    if (status) filters.status = status
    if (customerId) filters.customer_id = customerId

    const rawPrescriptions = await prescriptionService.listPrescriptions(
      filters,
      { order: { created_at: "DESC" }, take: 100, relations: ["lines"] }
    )

    let prescriptions: any[] = Array.isArray(rawPrescriptions?.[0])
      ? rawPrescriptions[0]
      : Array.isArray(rawPrescriptions)
        ? rawPrescriptions
        : []

    // For pending_review: prioritize H1 prescriptions
    if (status === "pending_review" && prescriptions.length > 0) {
      const productIds = new Set<string>()
      for (const rx of prescriptions) {
        for (const line of rx.lines ?? []) {
          if (line.product_id) productIds.add(line.product_id)
        }
      }

      let h1ProductIds = new Set<string>()
      if (productIds.size > 0) {
        try {
          const drugs = await pharmaService.listDrugProducts(
            { product_id: Array.from(productIds) },
            {}
          )
          const drugList: any[] = Array.isArray(drugs?.[0]) ? drugs[0] : Array.isArray(drugs) ? drugs : []
          for (const drug of drugList) {
            if (drug.schedule === "H1" && drug.product_id) h1ProductIds.add(drug.product_id)
          }
        } catch {
          // Non-fatal
        }
      }

      prescriptions.sort((a, b) => {
        const aH1 = (a.lines ?? []).some((l: any) => l.product_id && h1ProductIds.has(l.product_id))
        const bH1 = (b.lines ?? []).some((l: any) => l.product_id && h1ProductIds.has(l.product_id))
        if (aH1 && !bH1) return -1
        if (!aH1 && bH1) return 1
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
    }

    const result = isPhiEncryptionEnabled()
      ? decryptPhiArray(prescriptions, PRESCRIPTION_PHI_FIELDS)
      : prescriptions

    return res.json({ prescriptions: result, count: result.length })
  } catch (err: any) {
    logger.error("Failed to list prescriptions:", err?.message)
    return res.status(500).json({ error: "Failed to load prescriptions" })
  }
}
