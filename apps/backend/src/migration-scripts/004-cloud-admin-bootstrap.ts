/**
 * Cloud admin bootstrap migration.
 *
 * Assigns super_admin to the Medusa Cloud account owner automatically on
 * every fresh deploy. Reads the target email from the CLOUD_ADMIN_EMAIL
 * environment variable. If the variable is not set, the migration is a no-op.
 *
 * Set in Medusa Cloud project settings:
 *   CLOUD_ADMIN_EMAIL=suprameds@gmail.com
 *
 * This migration is idempotent — safe to re-run. If the user already has
 * super_admin the assignment is silently skipped.
 */

import { MedusaContainer } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../modules/rbac"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:004-cloud-admin-bootstrap")

export default async function cloudAdminBootstrap({
  container,
}: {
  container: MedusaContainer
}) {
  const cloudAdminEmail = process.env.CLOUD_ADMIN_EMAIL?.trim()

  if (!cloudAdminEmail) {
    logger.info(
      "004-cloud-admin-bootstrap: CLOUD_ADMIN_EMAIL not set — skipping."
    )
    return
  }

  logger.info(
    `004-cloud-admin-bootstrap: ensuring super_admin for ${cloudAdminEmail}`
  )

  const userService = container.resolve(Modules.USER) as any
  const rbacService = container.resolve(RBAC_MODULE) as any

  // ── Find the user ──────────────────────────────────────────────────────

  let userId: string

  try {
    const [users] = await userService.listAndCountUsers(
      { email: cloudAdminEmail },
      { take: 1 }
    )

    if (!users?.length) {
      logger.warn(
        `004-cloud-admin-bootstrap: no user found for "${cloudAdminEmail}". ` +
          `Medusa Cloud may not have provisioned the admin user yet.`
      )
      return
    }

    userId = users[0].id
    logger.info(`004-cloud-admin-bootstrap: found user ${userId}`)
  } catch (err: any) {
    logger.error(
      `004-cloud-admin-bootstrap: user lookup failed — ${err.message}`
    )
    return
  }

  // ── Assign super_admin (idempotent) ────────────────────────────────────

  try {
    await rbacService.assignRole(
      userId,
      "super_admin",
      "system:bootstrap",
      "004-cloud-admin-bootstrap migration"
    )
    logger.info(
      `004-cloud-admin-bootstrap: super_admin assigned to ${cloudAdminEmail}`
    )
  } catch (err: any) {
    if (err.message?.includes("already has active role")) {
      logger.info(
        `004-cloud-admin-bootstrap: ${cloudAdminEmail} already has super_admin — no action needed.`
      )
    } else {
      logger.error(
        `004-cloud-admin-bootstrap: assignRole failed — ${err.message}`
      )
      throw err
    }
  }
}
