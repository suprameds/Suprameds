import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { COMPLIANCE_MODULE } from "../../../../modules/compliance"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("admin:compliance:phi-logs")

/**
 * GET /admin/compliance/phi-logs
 * Lists PHI (Protected Health Information) audit log entries.
 * Query params: limit, offset, user_id, action, from, to
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const complianceService = req.scope.resolve(COMPLIANCE_MODULE) as any

    const limit = Number(req.query.limit) || 50
    const offset = Number(req.query.offset) || 0
    const filters: Record<string, any> = {}

    if (req.query.user_id) {
      filters.user_id = req.query.user_id
    }
    if (req.query.action) {
      filters.action = req.query.action
    }
    if (req.query.from || req.query.to) {
      filters.created_at = {}
      if (req.query.from) filters.created_at.$gte = req.query.from
      if (req.query.to) filters.created_at.$lte = req.query.to
    }

    const logs = await complianceService.listPhiAuditLogs(
      filters,
      {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      }
    )

    res.json({ phi_logs: logs, count: logs.length, limit, offset })
  } catch (err) {
    logger.error(`GET failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to fetch PHI audit logs" })
  }
}

/**
 * POST /admin/compliance/phi-logs
 * Creates a PHI audit log entry (manual logging by compliance officers).
 * Body: { user_id, action, resource_type, resource_id, details }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = req.body as Record<string, any>

  if (!body.action || !body.resource_type) {
    return res.status(400).json({
      error: "action and resource_type are required",
    })
  }

  try {
    const complianceService = req.scope.resolve(COMPLIANCE_MODULE) as any
    const actorId = (req as any).auth_context?.actor_id || "unknown"

    const log = await complianceService.createPhiAuditLogs({
      user_id: body.user_id || actorId,
      action: body.action,
      resource_type: body.resource_type,
      resource_id: body.resource_id || null,
      details: body.details || null,
      ip_address: req.ip || "unknown",
      user_agent: req.headers["user-agent"] || "unknown",
    })

    res.status(201).json({ phi_log: log })
  } catch (err) {
    logger.error(`POST failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to create PHI audit log" })
  }
}
