import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRESCRIPTION_MODULE } from "../../../../modules/prescription"
import { DISPENSE_MODULE } from "../../../../modules/dispense"
import { COMPLIANCE_MODULE } from "../../../../modules/compliance"

/**
 * GET /admin/pharmacist/stats
 * Returns aggregated dashboard stats for the pharmacist portal.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any
    const dispenseService = req.scope.resolve(DISPENSE_MODULE) as any
    const complianceService = req.scope.resolve(COMPLIANCE_MODULE) as any

    // Start of today in UTC
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const todayIso = todayStart.toISOString()

    // 1. Prescriptions pending pharmacist review
    const pendingRx = await prescriptionService.listPrescriptions({
      status: "pending_review",
    })
    const pendingRxList = Array.isArray(pendingRx?.[0])
      ? pendingRx[0]
      : Array.isArray(pendingRx)
      ? pendingRx
      : []

    // 2. Dispense decisions made today
    const decisionsToday = await dispenseService.listDispenseDecisions({
      created_at: { gte: todayIso },
    })
    const decisionsList = Array.isArray(decisionsToday?.[0])
      ? decisionsToday[0]
      : Array.isArray(decisionsToday)
      ? decisionsToday
      : []

    // 3. H1 register entries logged today
    const h1Today = await complianceService.listH1RegisterEntries({
      created_at: { gte: todayIso },
    })
    const h1List = Array.isArray(h1Today?.[0])
      ? h1Today[0]
      : Array.isArray(h1Today)
      ? h1Today
      : []

    // 4. Pre-dispatch sign-offs that are pending (not yet approved)
    const preDispatch = await dispenseService.listPreDispatchSignOffs({
      approved: false,
    })
    const preDispatchList = Array.isArray(preDispatch?.[0])
      ? preDispatch[0]
      : Array.isArray(preDispatch)
      ? preDispatch
      : []

    return res.json({
      pending_rx_count: pendingRxList.length,
      decisions_today: decisionsList.length,
      h1_entries_today: h1List.length,
      pre_dispatch_pending: preDispatchList.length,
    })
  } catch (err: any) {
    console.error("[admin:pharmacist:stats] GET failed:", err?.message)
    return res.status(500).json({ error: "Failed to fetch pharmacist stats" })
  }
}
