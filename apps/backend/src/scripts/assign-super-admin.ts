/**
 * One-time bootstrap script — assign super_admin to an existing admin user.
 *
 * Use this when a Medusa Cloud account owner ends up with no RBAC roles
 * because they weren't in the DEFAULT_USERS list in 002-rbac-seed.ts.
 *
 * Usage:
 *   TARGET_EMAIL=suprameds@gmail.com npx medusa exec ./src/scripts/assign-super-admin.ts
 *
 * Environment variables:
 *   TARGET_EMAIL   — Email of the user to promote (default: suprameds@gmail.com)
 */

import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../modules/rbac"

export default async function assignSuperAdmin({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const userService = container.resolve(Modules.USER) as any
  const rbacService = container.resolve(RBAC_MODULE) as any

  const targetEmail = process.env.TARGET_EMAIL ?? "suprameds@gmail.com"

  logger.info(`assign-super-admin: targeting ${targetEmail}`)

  // ── 1. Find the user ───────────────────────────────────────────────────

  const [users] = await userService.listAndCountUsers(
    { email: targetEmail },
    { take: 1 }
  )

  if (!users?.length) {
    logger.error(
      `assign-super-admin: no user found with email "${targetEmail}". ` +
        `Make sure the Medusa admin user exists before running this script.`
    )
    return
  }

  const user = users[0]
  logger.info(`assign-super-admin: found user ${user.id} (${user.email})`)

  // ── 2. Check if super_admin is already assigned ────────────────────────

  const [roles] = await rbacService.listAndCountRoles({ code: "super_admin" })
  if (!roles?.length) {
    logger.error(
      `assign-super-admin: role "super_admin" not found. ` +
        `Run the RBAC seed first: npx medusa exec ./src/scripts/run-migrations.ts`
    )
    return
  }

  const superAdminRole = roles[0]

  const existingAssignments = await rbacService.listUserRoles({
    user_id: user.id,
    role_id: superAdminRole.id,
    is_active: true,
  })

  if (existingAssignments?.length > 0) {
    logger.info(
      `assign-super-admin: ${targetEmail} already has super_admin — nothing to do.`
    )
    return
  }

  // ── 3. Assign the role ─────────────────────────────────────────────────

  try {
    await rbacService.assignRole(
      user.id,
      "super_admin",
      "system:bootstrap",
      "Assigned via assign-super-admin script"
    )
    logger.info(
      `assign-super-admin: super_admin assigned to ${targetEmail} (${user.id})`
    )
  } catch (err: any) {
    if (err.message?.includes("already has active role")) {
      logger.info(`assign-super-admin: ${targetEmail} already has super_admin.`)
    } else {
      logger.error(`assign-super-admin: failed to assign role — ${err.message}`)
      throw err
    }
  }

  // ── 4. Audit log ───────────────────────────────────────────────────────

  try {
    await rbacService.createRoleAuditLogs({
      user_id: user.id,
      role_id: superAdminRole.id,
      action: "assign",
      performed_by: "system:bootstrap",
      reason: "Assigned via assign-super-admin script",
    })
  } catch (err: any) {
    // Audit log failure is non-fatal
    logger.warn(`assign-super-admin: audit log failed — ${err.message}`)
  }

  logger.info("assign-super-admin: done.")
}
