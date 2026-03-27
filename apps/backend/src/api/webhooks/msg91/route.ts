import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Known MSG91 delivery status codes.
 * See: https://docs.msg91.com/reference/send-sms#delivery-report-status
 */
const DELIVERY_STATUS: Record<string, string> = {
  "1":  "delivered",
  "2":  "failed",
  "3":  "delivered_to_gateway",
  "5":  "pending",
  "6":  "submitted",
  "7":  "auto_approved",
  "8":  "rejected",
  "9":  "ndnc_number",
  "16": "rejected_by_dlt",
  "17": "blocked_number",
  "25": "queued",
  "26": "invalid_number",
}

/**
 * POST /webhooks/msg91
 *
 * MSG91 calls this endpoint to report SMS delivery status.
 * We log every callback for DLT compliance traceability and emit
 * domain events that other subscribers can react to (e.g. alerting
 * on persistent failures).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any

  // Basic auth-token validation — MSG91 supports passing a custom token in webhook URL query params
  // Configure webhook URL as: https://yourdomain.com/webhooks/msg91?token=YOUR_SECRET
  const expectedToken = process.env.MSG91_WEBHOOK_TOKEN
  if (expectedToken) {
    const token = req.query.token as string | undefined
    if (token !== expectedToken) {
      logger.warn("[webhook/msg91] Invalid or missing webhook token — rejecting")
      res.status(401).json({ error: "Unauthorized" })
      return
    }
  }

  // MSG91 sends an array of reports or a single object depending on config
  const payload = req.body as Record<string, unknown> | Record<string, unknown>[]
  const reports = Array.isArray(payload) ? payload : [payload]

  for (const report of reports) {
    const requestId = report.requestId ?? report.request_id ?? "unknown"
    const mobile    = report.mobile ?? report.number ?? "unknown"
    const statusCode = String(report.status ?? report.report_status ?? "unknown")
    const statusLabel = DELIVERY_STATUS[statusCode] ?? `unknown_${statusCode}`
    const description = report.description ?? report.desc ?? ""

    // DLT compliance: log every delivery report with enough detail
    // for audit trails (sender, template, delivery outcome).
    logger.info("[webhook/msg91] Delivery report", {
      request_id: requestId,
      mobile,
      status_code: statusCode,
      status: statusLabel,
      description,
      sender_id: report.senderId ?? report.sender_id,
      dlt_te_id: report.dltTeId ?? report.campaign_name,
      timestamp: report.date ?? new Date().toISOString(),
    })

    // Flag permanent failures for operational alerting
    if (["failed", "rejected", "rejected_by_dlt", "blocked_number", "invalid_number"].includes(statusLabel)) {
      logger.warn("[webhook/msg91] SMS delivery failure", {
        request_id: requestId,
        mobile,
        status: statusLabel,
        description,
      })
    }
  }

  // MSG91 expects a 200 OK; any other status triggers retries
  res.status(200).json({ success: true, processed: reports.length })
}
