import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../../../../../../modules/rbac"
import { createLogger } from "../../../../../../lib/logger"

const logger = createLogger("admin:rbac:signup-review")

/**
 * POST /admin/rbac/signup-requests/:id/review — Approve or reject a signup request.
 *
 * Body: { action: "approve" | "reject", rejection_reason?: string }
 *
 * On approve:
 *   - Assigns the requested role to the user via rbacService.assignRole
 *   - Updates SignupRequest status to "approved"
 *
 * On reject:
 *   - Updates SignupRequest status to "rejected" with optional reason
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const rbacService = req.scope.resolve(RBAC_MODULE) as any
  const reviewerId = req.auth_context?.actor_id

  if (!reviewerId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Authentication required"
    )
  }

  const requestId = req.params.id
  const { action, rejection_reason } = req.body as {
    action?: string
    rejection_reason?: string
  }

  if (!action || !["approve", "reject"].includes(action)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'action must be "approve" or "reject"'
    )
  }

  // ── Retrieve the signup request ────────────────────────────────────
  let signupRequest: any
  try {
    signupRequest = await rbacService.retrieveSignupRequest(requestId)
  } catch {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Signup request "${requestId}" not found`
    )
  }

  if (signupRequest.status !== "pending") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `This request has already been ${signupRequest.status}`
    )
  }

  if (!signupRequest.user_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "This signup request has no associated user — cannot process"
    )
  }

  const now = new Date()

  try {
    if (action === "approve") {
      // Assign the requested role
      await rbacService.assignRole(
        signupRequest.user_id,
        signupRequest.requested_role_code,
        reviewerId,
        `Signup request approved`
      )

      // Update the signup request
      await rbacService.updateSignupRequests({
        id: requestId,
        status: "approved",
        reviewed_by: reviewerId,
        reviewed_at: now,
      })

      logger.info(
        `Signup request ${requestId} approved: ${signupRequest.email} → ${signupRequest.requested_role_code} by ${reviewerId}`
      )

      return res.json({
        success: true,
        message: `Approved: ${signupRequest.email} now has the "${signupRequest.requested_role_code}" role.`,
        signup_request: {
          id: requestId,
          status: "approved",
          reviewed_by: reviewerId,
          reviewed_at: now.toISOString(),
        },
      })
    } else {
      // Reject
      await rbacService.updateSignupRequests({
        id: requestId,
        status: "rejected",
        reviewed_by: reviewerId,
        reviewed_at: now,
        rejection_reason: rejection_reason?.trim() || null,
      })

      logger.info(
        `Signup request ${requestId} rejected: ${signupRequest.email} (${signupRequest.requested_role_code}) by ${reviewerId}`
      )

      return res.json({
        success: true,
        message: `Rejected: signup request for ${signupRequest.email} (${signupRequest.requested_role_code}).`,
        signup_request: {
          id: requestId,
          status: "rejected",
          reviewed_by: reviewerId,
          reviewed_at: now.toISOString(),
          rejection_reason: rejection_reason?.trim() || null,
        },
      })
    }
  } catch (error: any) {
    if (error instanceof MedusaError) throw error
    logger.error(`Review failed for ${requestId}: ${error.message}`)
    return res.status(500).json({
      message: error.message || "Failed to process signup request review",
    })
  }
}
