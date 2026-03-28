import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../modules/rbac"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:invite-accepted")

/**
 * When a new admin user is created (typically via invite acceptance),
 * auto-assign the RBAC role that was selected at invite time.
 * Falls back to "viewer" if no role was pre-selected.
 */
export default async function userCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const userId = data.id
  logger.info(`New user created: ${userId}`)

  try {
    const rbacService = container.resolve(RBAC_MODULE) as any
    const userService = container.resolve(Modules.USER) as any

    // Retrieve the user to get their email
    let user: any
    try {
      user = await userService.retrieveUser(userId)
    } catch {
      logger.warn(`Could not retrieve user ${userId} — skipping role assignment`)
      return
    }

    if (!user?.email) {
      logger.warn(`User ${userId} has no email — skipping role assignment`)
      return
    }

    // Check if this user already has roles (e.g., created via CLI, not invite)
    const existingRoles = await rbacService.getUserRoles(userId)
    if (existingRoles.length > 0) {
      logger.info(
        `User ${userId} already has roles [${existingRoles.join(", ")}] — skipping`
      )
      return
    }

    // Auto-assign: consumes InviteRole mapping or defaults to "viewer"
    const assignedRole = await rbacService.assignDefaultRole(userId, user.email)
    logger.info(
      `Auto-assigned role "${assignedRole}" to user ${userId} (${user.email})`
    )
  } catch (error) {
    // Never let subscriber failures break user creation
    logger.error(
      `Failed to assign role for user ${userId}:`,
      (error as Error).message
    )
    captureException(error, { subscriber: "invite-accepted", userId })
  }
}

export const config: SubscriberConfig = {
  event: "user.created",
}
