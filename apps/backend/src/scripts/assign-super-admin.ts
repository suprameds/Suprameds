import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { RBAC_MODULE } from "../modules/rbac"

/**
 * One-off script: assign super_admin role to admin@admin.com
 * Run with: npx medusa exec src/scripts/assign-super-admin.ts
 */
export default async function assignSuperAdmin({ container }: { container: MedusaContainer }) {
  const userService = container.resolve(Modules.USER) as any
  const rbacService = container.resolve(RBAC_MODULE) as any

  const targetEmail = "admin@admin.com"

  // Find the user
  const [users] = await userService.listAndCountUsers(
    { email: targetEmail },
    { take: 1 }
  )

  if (users.length === 0) {
    console.error(`User with email "${targetEmail}" not found`)
    return
  }

  const user = users[0]
  console.log(`Found user: ${user.id} (${user.email})`)

  // First re-seed roles to make sure super_admin exists with tier data
  try {
    await rbacService.seedRolesAndPermissions()
    console.log("Roles re-seeded with latest tier data")
  } catch (err: any) {
    console.warn(`Seed warning: ${err.message}`)
  }

  // Assign super_admin
  try {
    await rbacService.assignRole(user.id, "super_admin", "system:bootstrap", "Initial super_admin assignment")
    console.log(`✓ super_admin role assigned to ${targetEmail} (${user.id})`)
  } catch (err: any) {
    if (err.message?.includes("already has active role")) {
      console.log(`User ${targetEmail} already has super_admin role`)
    } else {
      console.error(`Failed to assign super_admin: ${err.message}`)
    }
  }
}
