import type {
  MedusaRequest,
  MedusaResponse,
  MedusaNextFunction,
} from "@medusajs/framework/http"
import { RBAC_MODULE } from "../modules/rbac"

/**
 * RBAC authorization middleware factory.
 *
 * Usage in middlewares.ts:
 *   {
 *     matcher: "/admin/prescriptions/:id",
 *     method: "POST",
 *     middlewares: [authorize("prescription", "approve")],
 *   }
 *
 * Flow:
 *  1. Reads `req.auth_context.actor_id` — 401 if missing
 *  2. Resolves the RBAC module from the DI container
 *  3. Calls `checkPermission(userId, resource, action)`
 *  4. 403 if denied, next() if permitted
 *  5. Fail-closed: if RBAC module is unavailable, returns 503 (never allows unauthorized access)
 */
export function authorize(resource: string, action: string) {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    const userId = (req as any).auth_context?.actor_id
    if (!userId) {
      res.status(401).json({
        type: "unauthorized",
        message: "Authentication required",
      })
      return
    }

    try {
      const rbacService = req.scope.resolve(RBAC_MODULE) as any

      const permitted = await rbacService.checkPermission(
        userId,
        resource,
        action
      )

      if (!permitted) {
        res.status(403).json({
          type: "forbidden",
          message: `You do not have permission to ${action} ${resource}`,
        })
        return
      }

      next()
    } catch (err: any) {
      // Fail-closed: if RBAC module is unavailable, deny access
      const logger = req.scope.resolve("logger") as any
      logger.error(
        `[rbac] authorize("${resource}", "${action}") failed for user ${userId}: ${err.message}. Denying request (fail-closed).`
      )
      res.status(503).json({
        type: "service_unavailable",
        message: "Authorization service is temporarily unavailable. Please try again later.",
      })
      return
    }
  }
}

/**
 * Static Separation of Duties (SSD) enforcement middleware.
 *
 * Prevents the same user from performing two conflicting actions on the
 * same entity (e.g. a pharmacist cannot approve their own prescription upload).
 *
 * Usage in middlewares.ts:
 *   {
 *     matcher: "/admin/prescriptions/:id",
 *     method: "POST",
 *     middlewares: [enforceSsd("SSD-01", getPrescriptionUploader)],
 *   }
 *
 * @param rule   - SSD rule identifier (e.g. "SSD-01", "SSD-02")
 * @param getRelatedUserId - async fn that extracts the "other party" user ID
 *                           from the request (e.g. prescription uploader, GRN creator)
 */
export function enforceSsd(
  rule: string,
  getRelatedUserId: (req: MedusaRequest) => Promise<string | null>
) {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    const currentUserId = (req as any).auth_context?.actor_id
    if (!currentUserId) {
      // No authenticated user — SSD is irrelevant; let the auth middleware handle it
      return next()
    }

    let relatedUserId: string | null = null
    try {
      relatedUserId = await getRelatedUserId(req)
    } catch (err: any) {
      const logger = req.scope.resolve("logger") as any
      logger.warn(
        `[rbac] enforceSsd(${rule}) could not resolve related user: ${err.message}. Skipping SSD check.`
      )
      return next()
    }

    // If we can't determine the related user, skip the SSD check
    if (!relatedUserId) {
      return next()
    }

    // Same user performing both conflicting actions → validate via RBAC module
    if (currentUserId === relatedUserId) {
      try {
        const rbacService = req.scope.resolve(RBAC_MODULE) as any

        const result = await rbacService.validateSsd(
          rule,
          currentUserId,
          relatedUserId
        )

        if (!result.valid) {
          res.status(403).json({
            type: "forbidden",
            message: result.message ?? `Separation of duties violation (${rule})`,
          })
          return
        }
      } catch (err: any) {
        // Fail-closed: if RBAC module is unavailable, deny access
        const logger = req.scope.resolve("logger") as any
        logger.error(
          `[rbac] enforceSsd(${rule}) validation failed: ${err.message}. Denying request (fail-closed).`
        )
        res.status(503).json({
          type: "service_unavailable",
          message: "Authorization service is temporarily unavailable. Please try again later.",
        })
        return
      }
    }

    next()
  }
}
