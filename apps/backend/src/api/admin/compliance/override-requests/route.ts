import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { COMPLIANCE_MODULE } from "../../../../modules/compliance"
import { createLogger } from "../../../../lib/logger"

const logger = createLogger("admin:compliance:override-requests")

/**
 * GET /admin/compliance/override-requests
 * Lists compliance override requests with optional filters.
 * Query params: limit, offset, status, override_type, requested_by
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const complianceService = req.scope.resolve(COMPLIANCE_MODULE) as any

    const limit = Number(req.query.limit) || 20
    const offset = Number(req.query.offset) || 0
    const filters: Record<string, any> = {}

    if (req.query.status) {
      filters.status = req.query.status
    }
    if (req.query.override_type) {
      filters.override_type = req.query.override_type
    }
    if (req.query.requested_by) {
      filters.requested_by = req.query.requested_by
    }

    const requests = await complianceService.listOverrideRequests(
      filters,
      {
        take: limit,
        skip: offset,
        order: { created_at: "DESC" },
      }
    )

    res.json({ override_requests: requests, count: requests.length, limit, offset })
  } catch (err) {
    logger.error(`GET failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to list override requests" })
  }
}

/**
 * POST /admin/compliance/override-requests
 * Creates a compliance override request.
 * Body: { override_type, target_entity_type, target_entity_id,
 *         justification, risk_assessment, patient_impact?,
 *         supporting_doc_url?, valid_for_hours? }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = req.body as Record<string, any>

  const required = ["override_type", "target_entity_type", "target_entity_id", "justification", "risk_assessment"]
  const missing = required.filter((f) => !body[f])
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing required fields: ${missing.join(", ")}`,
    })
  }

  try {
    const complianceService = req.scope.resolve(COMPLIANCE_MODULE) as any
    const actorId = (req as any).auth_context?.actor_id || "unknown"

    // Determine role from RBAC
    let actorRole = "unknown"
    try {
      const rbacService = req.scope.resolve("pharmaRbac") as any
      const userRoles = await rbacService.listUserRoles({ user_id: actorId, is_active: true })
      const roleList = Array.isArray(userRoles?.[0]) ? userRoles[0] : Array.isArray(userRoles) ? userRoles : []
      if (roleList.length > 0) {
        actorRole = roleList[0].role?.code || roleList[0].role_code || "unknown"
      }
    } catch {
      // RBAC not available
    }

    // Dual auth for high-risk overrides
    const highRiskTypes = ["schedule_restriction", "expired_batch", "recall_override"]
    const requiresDualAuth = highRiskTypes.includes(body.override_type)

    const validHours = body.valid_for_hours || 24
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + validHours)

    const overrideReq = await complianceService.createOverrideRequests({
      override_type: body.override_type,
      target_entity_type: body.target_entity_type,
      target_entity_id: body.target_entity_id,
      requested_by: actorId,
      requested_by_role: actorRole,
      justification: body.justification,
      patient_impact: body.patient_impact || null,
      risk_assessment: body.risk_assessment,
      supporting_doc_url: body.supporting_doc_url || null,
      requires_dual_auth: requiresDualAuth,
      status: "pending_primary",
      valid_for_hours: validHours,
      expires_at: expiresAt,
    })

    logger.info(`Override request created: ${overrideReq.id} by ${actorId}`)
    res.status(201).json({ override_request: overrideReq })
  } catch (err) {
    logger.error(`POST failed:`, (err as Error).message)
    res.status(500).json({ error: "Failed to create override request" })
  }
}
