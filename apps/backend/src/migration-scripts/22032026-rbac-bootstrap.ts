import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../modules/rbac"

/**
 * RBAC Bootstrap — runs automatically during `db:migrate`.
 *
 * 1. Seeds all 25 roles + ~65 permissions via the canonical seed file
 * 2. Finds the FIRST admin user and assigns super_admin if nobody holds it yet
 *
 * Idempotent: safe to re-run on every deploy (Medusa Cloud or local).
 */
export default async function rbacBootstrap({
  container,
}: {
  container: MedusaContainer
}) {
  const LOG = "[rbac-bootstrap]"
  const rbacService = container.resolve(RBAC_MODULE) as any
  const userService = container.resolve(Modules.USER) as any

  // ── 1. Seed roles & permissions ──────────────────────────────────────────

  try {
    await rbacService.seedRolesAndPermissions()
    console.info(`${LOG} Roles and permissions seeded successfully`)
  } catch (err: any) {
    console.warn(`${LOG} Seed warning: ${err.message}`)
  }

  // ── 2. Auto-assign super_admin to first user if none exists ──────────────

  try {
    const [superAdminRole] = (await rbacService.listRoles(
      { code: "super_admin" },
      { take: 1 }
    )) as any[]

    if (!superAdminRole) {
      console.warn(`${LOG} super_admin role not found — skipping auto-assign`)
      return
    }

    // Check if ANY user already holds super_admin
    const existingSuperAdmins = (await rbacService.listUserRoles(
      { role_id: superAdminRole.id, is_active: true },
      { take: 1 }
    )) as any[]

    if (existingSuperAdmins.length > 0) {
      console.info(`${LOG} super_admin already assigned — skipping`)
      return
    }

    // No super_admin exists yet — find the first admin user
    const [users] = await userService.listAndCountUsers({}, { take: 10 })

    if (!users || users.length === 0) {
      console.warn(`${LOG} No admin users found — super_admin will be assigned when first user is created`)
      return
    }

    // Pick the first user (oldest created)
    const firstUser = users[0]
    console.info(`${LOG} No super_admin found — assigning to first user: ${firstUser.email} (${firstUser.id})`)

    await rbacService.assignRole(
      firstUser.id,
      "super_admin",
      "system:bootstrap",
      "Auto-assigned during initial deployment — first admin user"
    )
    console.info(`${LOG} super_admin assigned to ${firstUser.email}`)
  } catch (err: any) {
    if (err.message?.includes("already has active role")) {
      console.info(`${LOG} First user already has super_admin — OK`)
    } else {
      console.error(`${LOG} Failed to auto-assign super_admin: ${err.message}`)
    }
  }
}
