/**
 * RBAC seed -- roles, permissions, and default admin users.
 *
 * Merged from former 012-rbac-bootstrap.ts + 013-bootstrap-super-admin.ts,
 * extended to create default users for all key operational roles.
 *
 * Steps:
 *   1. Seed all 25 roles + ~65 permissions via rbacService.seedRolesAndPermissions()
 *   2. Create admin users for 10 key roles (idempotent -- skip if email exists)
 *
 * Every operation is wrapped in try/catch for idempotency. Safe to re-run
 * on every deploy (Medusa Cloud or local).
 */

import { MedusaContainer } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"
import { RBAC_MODULE } from "../modules/rbac"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:002-rbac-seed")

/**
 * Default admin users to bootstrap. Each maps to an operational role.
 * Credentials should be changed after first login in production.
 */
const DEFAULT_USERS: Array<{
  email: string
  password: string
  firstName: string
  lastName: string
  roles: string[]
}> = [
  {
    email: "admin@suprameds.in",
    password: "Suprameds@2026!",
    firstName: "Super",
    lastName: "Admin",
    roles: ["super_admin"],
  },
  {
    email: "super_admin@gmail.com",
    password: "Suprameds@2026!",
    firstName: "Nikhil",
    lastName: "Admin",
    roles: ["super_admin"],
  },
  {
    email: "pic@suprameds.in",
    password: "Suprameds@2026!",
    firstName: "Dr. Rajesh",
    lastName: "Kumar",
    roles: ["pharmacist_in_charge"],
  },
  {
    email: "pharmacist@suprameds.in",
    password: "Suprameds@2026!",
    firstName: "Priya",
    lastName: "Sharma",
    roles: ["pharmacist"],
  },
  {
    email: "warehouse@suprameds.in",
    password: "Suprameds@2026!",
    firstName: "Amit",
    lastName: "Patel",
    roles: ["warehouse_manager"],
  },
  {
    email: "warehouse.staff@suprameds.in",
    password: "Suprameds@2026!",
    firstName: "Ravi",
    lastName: "Singh",
    roles: ["picker"],
  },
  {
    email: "delivery@suprameds.in",
    password: "Suprameds@2026!",
    firstName: "Suresh",
    lastName: "Reddy",
    roles: ["dispatch_staff"],
  },
  {
    email: "support@suprameds.in",
    password: "Suprameds@2026!",
    firstName: "Anita",
    lastName: "Desai",
    roles: ["support_agent"],
  },
  {
    email: "compliance@suprameds.in",
    password: "Suprameds@2026!",
    firstName: "Vikram",
    lastName: "Mehta",
    roles: ["compliance_officer"],
  },
  {
    email: "finance@suprameds.in",
    password: "Suprameds@2026!",
    firstName: "Deepa",
    lastName: "Iyer",
    roles: ["finance_admin"],
  },
  {
    email: "marketing@suprameds.in",
    password: "Suprameds@2026!",
    firstName: "Neha",
    lastName: "Gupta",
    roles: ["marketing_admin"],
  },
]

export default async function rbacSeed({
  container,
}: {
  container: MedusaContainer
}) {
  const rbacService = container.resolve(RBAC_MODULE) as any

  // ── 1. Seed roles and permissions ───────────────────────────────────────

  try {
    await rbacService.seedRolesAndPermissions()
    logger.info("Roles and permissions seeded successfully.")
  } catch (err: any) {
    logger.warn(`Seed roles warning: ${err.message}`)
  }

  // ── 2. Create default admin users ──────────────────────────────────────

  let created = 0
  let skipped = 0

  for (const user of DEFAULT_USERS) {
    try {
      const wasCreated = await ensureAdminUser(
        container,
        user.email,
        user.password,
        user.firstName,
        user.lastName,
        user.roles
      )
      if (wasCreated) {
        created++
      } else {
        skipped++
      }
    } catch (err: any) {
      logger.error(`Failed to ensure user ${user.email}: ${err.message}`)
    }
  }

  logger.info(
    `RBAC seed complete. Users created: ${created}, already existed: ${skipped}.`
  )
}

/**
 * Ensures an admin user exists with the given email and role(s).
 *
 * 1. Check if user exists via userService.listAndCountUsers
 * 2. If not, register auth identity via authService.register("emailpass", ...)
 * 3. Create user via createUserAccountWorkflow
 * 4. Assign role(s) via rbacService.assignRole
 *
 * Returns true if the user was newly created, false if already existed.
 */
async function ensureAdminUser(
  container: MedusaContainer,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  roleCodes: string[]
): Promise<boolean> {
  const userService = container.resolve(Modules.USER) as any
  const authService = container.resolve(Modules.AUTH) as any
  const rbacService = container.resolve(RBAC_MODULE) as any

  // ── Check if user already exists ──────────────────────────────────────

  try {
    const [existingUsers] = await userService.listAndCountUsers(
      { email },
      { take: 1 }
    )
    if (existingUsers?.length > 0) {
      const userId = existingUsers[0].id
      logger.info(`User ${email} already exists (${userId}), ensuring roles...`)

      // Still ensure all roles are assigned
      for (const roleCode of roleCodes) {
        await safeAssignRole(rbacService, userId, roleCode)
      }
      return false
    }
  } catch (err: any) {
    logger.warn(`Could not check existing users for ${email}: ${err.message}`)
  }

  // ── 1. Register auth identity (emailpass provider) ────────────────────

  let authIdentityId: string
  try {
    const { success, authIdentity, error } = await authService.register(
      "emailpass",
      {
        body: {
          email,
          password,
        },
      }
    )

    if (!success || !authIdentity) {
      throw new Error(error || "Auth registration returned no identity")
    }

    authIdentityId = authIdentity.id
    logger.info(`Auth identity created for ${email}: ${authIdentityId}`)
  } catch (err: any) {
    // If auth identity already exists, try to find it
    if (
      err.message?.includes("already") ||
      err.message?.includes("exists") ||
      err.message?.includes("Identity")
    ) {
      logger.info(`Auth identity for ${email} may already exist, attempting to locate...`)
      try {
        const identities = await authService.listAuthIdentities(
          {},
          { take: null }
        )
        const existing = identities.find((ai: any) =>
          ai.provider_identities?.some(
            (pi: any) => pi.entity_id === email
          )
        )
        if (existing) {
          authIdentityId = existing.id
          logger.info(`Found existing auth identity for ${email}: ${authIdentityId}`)
        } else {
          throw new Error(`Could not locate existing auth identity for ${email}`)
        }
      } catch (findErr: any) {
        logger.error(`Failed to find/create auth identity for ${email}: ${findErr.message}`)
        return false
      }
    } else {
      logger.error(`Auth registration failed for ${email}: ${err.message}`)
      return false
    }
  }

  // ── 2. Create the admin user and link to auth identity ────────────────

  try {
    const { result: user } = await createUserAccountWorkflow(container).run({
      input: {
        authIdentityId: authIdentityId!,
        userData: {
          email,
          first_name: firstName,
          last_name: lastName,
          metadata: {
            bootstrap: true,
            created_by: "migration:002-rbac-seed",
          },
        },
      },
    })

    logger.info(`Admin user created: ${user.id} (${email})`)

    // ── 3. Assign role(s) ───────────────────────────────────────────────
    for (const roleCode of roleCodes) {
      await safeAssignRole(rbacService, user.id, roleCode)
    }

    return true
  } catch (err: any) {
    if (err.message?.includes("already") || err.message?.includes("exists")) {
      logger.info(`User ${email} may already exist -- skipping creation.`)
    } else {
      logger.error(`Failed to create admin user ${email}: ${err.message}`)
    }
    return false
  }
}

/**
 * Assigns a role to a user, silently succeeding if already assigned.
 */
async function safeAssignRole(
  rbacService: any,
  userId: string,
  roleCode: string
): Promise<void> {
  try {
    await rbacService.assignRole(
      userId,
      roleCode,
      "system:bootstrap",
      `Bootstrapped via migration:002-rbac-seed`
    )
    logger.info(`Role ${roleCode} assigned to user ${userId}.`)
  } catch (err: any) {
    if (err.message?.includes("already has active role")) {
      logger.info(`User ${userId} already has role ${roleCode}.`)
    } else {
      logger.warn(`Could not assign role ${roleCode} to ${userId}: ${err.message}`)
    }
  }
}
