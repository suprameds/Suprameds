/**
 * Bootstraps a super_admin account for initial platform access.
 *
 * Creates an admin user with emailpass auth and assigns the super_admin role.
 * Idempotent: skips if a user with the target email already exists.
 *
 * The MFA guard allows access without MFA setup — enforcement only kicks in
 * after the user voluntarily completes TOTP enrollment via /admin/mfa/setup.
 * This means the super_admin can log in immediately with just email + password.
 *
 * Credentials (change after first login):
 *   Email:    admin@suprameds.in
 *   Password: Suprameds@2026!
 */

import { MedusaContainer } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"
import { RBAC_MODULE } from "../modules/rbac"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:013-bootstrap-super-admin")

const SUPER_ADMIN_EMAIL = "admin@suprameds.in"
const SUPER_ADMIN_PASSWORD = "Suprameds@2026!"
const SUPER_ADMIN_FIRST_NAME = "Super"
const SUPER_ADMIN_LAST_NAME = "Admin"

export default async function bootstrapSuperAdmin({
  container,
}: {
  container: MedusaContainer
}) {
  const userService = container.resolve(Modules.USER) as any
  const authService = container.resolve(Modules.AUTH) as any

  // ── Idempotency: check if the user already exists ────────────────────

  try {
    const [existingUsers] = await userService.listAndCountUsers(
      { email: SUPER_ADMIN_EMAIL },
      { take: 1 }
    )
    if (existingUsers?.length > 0) {
      logger.info(`User ${SUPER_ADMIN_EMAIL} already exists (${existingUsers[0].id}) — skipping`)

      // Still ensure super_admin role is assigned
      await ensureSuperAdminRole(container, existingUsers[0].id)
      return
    }
  } catch (err: any) {
    logger.warn(`Could not check existing users: ${err.message}`)
  }

  // ── 1. Register auth identity (emailpass provider) ───────────────────

  let authIdentityId: string
  try {
    const { success, authIdentity, error } = await authService.register(
      "emailpass",
      {
        body: {
          email: SUPER_ADMIN_EMAIL,
          password: SUPER_ADMIN_PASSWORD,
        },
      }
    )

    if (!success || !authIdentity) {
      throw new Error(error || "Auth registration returned no identity")
    }

    authIdentityId = authIdentity.id
    logger.info(`Auth identity created: ${authIdentityId}`)
  } catch (err: any) {
    // If auth identity already exists, try to find it
    if (err.message?.includes("already") || err.message?.includes("exists") || err.message?.includes("Identity")) {
      logger.info(`Auth identity for ${SUPER_ADMIN_EMAIL} may already exist, attempting to locate...`)
      try {
        const identities = await authService.listAuthIdentities(
          {},
          { take: null }
        )
        const existing = identities.find((ai: any) =>
          ai.provider_identities?.some(
            (pi: any) => pi.entity_id === SUPER_ADMIN_EMAIL
          )
        )
        if (existing) {
          authIdentityId = existing.id
          logger.info(`Found existing auth identity: ${authIdentityId}`)
        } else {
          throw new Error("Could not locate existing auth identity")
        }
      } catch (findErr: any) {
        logger.error(`Failed to find/create auth identity: ${findErr.message}`)
        return
      }
    } else {
      logger.error(`Auth registration failed: ${err.message}`)
      return
    }
  }

  // ── 2. Create the admin user and link to auth identity ───────────────

  try {
    const { result: user } = await createUserAccountWorkflow(container).run({
      input: {
        authIdentityId: authIdentityId!,
        userData: {
          email: SUPER_ADMIN_EMAIL,
          first_name: SUPER_ADMIN_FIRST_NAME,
          last_name: SUPER_ADMIN_LAST_NAME,
          metadata: {
            bootstrap: true,
            created_by: "migration:bootstrap-super-admin",
          },
        },
      },
    })

    logger.info(`Admin user created: ${user.id} (${user.email})`)

    // ── 3. Assign super_admin role ───────────────────────────────────────
    await ensureSuperAdminRole(container, user.id)

    logger.info(`┌─────────────────────────────────────────────┐`)
    logger.info(`│  SUPER ADMIN ACCOUNT CREATED SUCCESSFULLY   │`)
    logger.info(`│                                             │`)
    logger.info(`│  Email:    ${SUPER_ADMIN_EMAIL.padEnd(28)}      │`)
    logger.info(`│  Password: ${SUPER_ADMIN_PASSWORD.padEnd(28)}      │`)
    logger.info(`│  MFA:      Not required until setup         │`)
    logger.info(`│                                             │`)
    logger.info(`│  ⚠  Change password after first login!      │`)
    logger.info(`└─────────────────────────────────────────────┘`)
  } catch (err: any) {
    if (err.message?.includes("already") || err.message?.includes("exists")) {
      logger.info(`User may already exist — skipping creation`)
    } else {
      logger.error(`Failed to create admin user: ${err.message}`)
    }
  }
}

/**
 * Ensures the user has the super_admin role assigned.
 * Silently succeeds if the role is already assigned.
 */
async function ensureSuperAdminRole(
  container: MedusaContainer,
  userId: string
): Promise<void> {
  try {
    const rbacService = container.resolve(RBAC_MODULE) as any
    const currentRoles = await rbacService.getUserRoles(userId)

    if (currentRoles.includes("super_admin")) {
      logger.info(`User ${userId} already has super_admin role`)
      return
    }

    await rbacService.assignRole(
      userId,
      "super_admin",
      "system:bootstrap",
      "Initial super_admin account — bootstrapped via migration"
    )
    logger.info(`super_admin role assigned to ${userId}`)
  } catch (err: any) {
    if (err.message?.includes("already has active role")) {
      logger.info(`super_admin role already assigned`)
    } else {
      logger.warn(`Could not assign super_admin role: ${err.message}`)
    }
  }
}
