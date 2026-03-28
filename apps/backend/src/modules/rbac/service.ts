import { MedusaService } from "@medusajs/framework/utils"
import Role from "./models/role"
import Permission from "./models/permission"
import UserRole from "./models/user-role"
import RoleAuditLog from "./models/role-audit-log"
import InviteRole from "./models/invite-role"
import MfaSecret from "./models/mfa-secret"
import StaffCredential from "./models/staff-credential"
import { seedRolesAndPermissions } from "./seeds/roles-permissions.seed"
import { createLogger } from "../../lib/logger"

const logger = createLogger("module:rbac")

// ---------------------------------------------------------------------------
// Static Separation-of-Duty rules
// ---------------------------------------------------------------------------

const SSD_RULES: Record<
  string,
  { description: string; message: string }
> = {
  "SSD-01": {
    description: "Rx submitter ≠ Rx approver",
    message: "The person who submitted the prescription cannot approve it",
  },
  "SSD-02": {
    description: "GRN creator ≠ GRN QC approver",
    message: "The person who created the GRN cannot QC-approve it",
  },
  "SSD-03": {
    description: "PO raiser ≠ PO approver",
    message: "The person who raised the purchase order cannot approve it",
  },
  "SSD-04": {
    description: "Refund raiser ≠ refund approver",
    message: "The person who initiated the refund cannot approve it",
  },
  "SSD-05": {
    description: "Content writer ≠ content approver",
    message: "The person who wrote the content cannot approve it",
  },
  "SSD-06": {
    description: "Recall initiator ≠ quarantine clearance approver",
    message: "The person who initiated the recall cannot clear quarantine",
  },
  "SSD-07": {
    description: "Compliance override requires super_admin",
    message: "Only a super_admin can authorize compliance overrides",
  },
  "SSD-08": {
    description: "CDSCO inspector cannot coexist with internal roles",
    message: "A CDSCO inspector account cannot hold internal operational roles",
  },
}

// Internal roles that conflict with cdsco_inspector (SSD-08)
const INTERNAL_ROLE_CODES = new Set([
  "pharmacist",
  "pharmacist_in_charge",
  "pharmacy_technician",
  "warehouse_manager",
  "grn_staff",
  "qc_staff",
  "picker",
  "packer",
  "dispatch_staff",
  "returns_staff",
  "support_agent",
  "support_supervisor",
  "catalog_manager",
  "content_moderator",
  "marketing_admin",
  "finance_admin",
  "compliance_officer",
  "platform_admin",
  "super_admin",
])

// ---------------------------------------------------------------------------
// TOTP utilities (RFC 6238) — Node.js built-in crypto, no external deps
// ---------------------------------------------------------------------------

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ""
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31]
  }
  return output
}

function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.replace(/[=\s]/g, "").toUpperCase()
  let bits = 0
  let value = 0
  const output: number[] = []
  for (const char of cleaned) {
    const idx = BASE32_CHARS.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(output)
}

/**
 * Verify a 6-digit TOTP code against a base32 secret.
 * Accepts codes from the current, previous, and next time steps (±1 window).
 */
function verifyTotp(secret: string, code: string, window = 1): boolean {
  const { createHmac } = require("crypto") as typeof import("crypto")
  const key = base32Decode(secret)
  const timeStep = 30
  const digits = 6
  const currentTime = Math.floor(Date.now() / 1000 / timeStep)

  for (let i = -window; i <= window; i++) {
    const time = currentTime + i
    const timeBuffer = Buffer.alloc(8)
    timeBuffer.writeUInt32BE(0, 0)
    timeBuffer.writeUInt32BE(time, 4)

    const hmac = createHmac("sha1", key).update(timeBuffer).digest()
    const offset = hmac[hmac.length - 1] & 0x0f
    const otp =
      (((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)) %
      Math.pow(10, digits)

    if (String(otp).padStart(digits, "0") === code) {
      return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * RbacModuleService — Role definitions, permissions, SSD validation.
 *
 * Auto-generated CRUD from MedusaService:
 *   listRoles / retrieveRole / createRoles / updateRoles / deleteRoles
 *   listPermissions / createPermissions
 *   listUserRoles / createUserRoles / updateUserRoles
 *   listRoleAuditLogs / createRoleAuditLogs
 */
class RbacModuleService extends MedusaService({
  Role,
  Permission,
  UserRole,
  RoleAuditLog,
  InviteRole,
  MfaSecret,
  StaffCredential,
}) {
  // -----------------------------------------------------------------------
  // assignRole — create UserRole + audit log with validation
  // -----------------------------------------------------------------------

  async assignRole(
    userId: string,
    roleCode: string,
    assignedBy: string,
    reason?: string
  ): Promise<any> {
    // Resolve role by code
    const [role] = (await this.listRoles({ code: roleCode }, { take: 1 })) as any[]
    if (!role) {
      throw new Error(`Role "${roleCode}" does not exist`)
    }

    // Prevent duplicate active assignments
    const [existing] = (await this.listUserRoles(
      { user_id: userId, role_id: role.id, is_active: true },
      { take: 1 }
    )) as any[]
    if (existing) {
      throw new Error(`User ${userId} already has active role "${roleCode}"`)
    }

    // SSD-08: cdsco_inspector cannot coexist with internal roles
    const currentRoles = await this.getUserRoles(userId)
    if (roleCode === "cdsco_inspector") {
      const hasInternal = currentRoles.some((rc) => INTERNAL_ROLE_CODES.has(rc))
      if (hasInternal) {
        throw new Error(
          `SSD-08 violation: cannot assign cdsco_inspector — user holds internal role(s): ${currentRoles.filter((rc) => INTERNAL_ROLE_CODES.has(rc)).join(", ")}`
        )
      }
    }
    if (INTERNAL_ROLE_CODES.has(roleCode) && currentRoles.includes("cdsco_inspector")) {
      throw new Error(
        `SSD-08 violation: cannot assign internal role "${roleCode}" — user is a CDSCO inspector`
      )
    }

    // super_admin cap enforcement
    if (roleCode === "super_admin") {
      const maxAccounts = role.metadata?.max_accounts ?? 3
      const activeSupers = (await this.listUserRoles(
        { role_id: role.id, is_active: true },
        { take: null }
      )) as any[]
      if (activeSupers.length >= maxAccounts) {
        throw new Error(
          `super_admin limit reached: maximum ${maxAccounts} accounts allowed`
        )
      }
    }

    // Create the assignment
    const userRole = await this.createUserRoles({
      user_id: userId,
      role_id: role.id,
      assigned_by: assignedBy,
      reason: reason ?? null,
    })

    // Audit trail
    await this.createRoleAuditLogs({
      user_id: userId,
      role_id: role.id,
      action: "assign",
      performed_by: assignedBy,
      reason: reason ?? null,
    })

    return userRole
  }

  // -----------------------------------------------------------------------
  // revokeRole — soft-delete UserRole + audit log
  // -----------------------------------------------------------------------

  async revokeRole(
    userId: string,
    roleCode: string,
    revokedBy: string,
    reason?: string
  ): Promise<void> {
    const [role] = (await this.listRoles({ code: roleCode }, { take: 1 })) as any[]
    if (!role) {
      throw new Error(`Role "${roleCode}" does not exist`)
    }

    const [userRole] = (await this.listUserRoles(
      { user_id: userId, role_id: role.id, is_active: true },
      { take: 1 }
    )) as any[]
    if (!userRole) {
      throw new Error(`User ${userId} does not have active role "${roleCode}"`)
    }

    // Soft-delete by deactivating
    await this.updateUserRoles({ id: userRole.id, is_active: false })

    await this.createRoleAuditLogs({
      user_id: userId,
      role_id: role.id,
      action: "revoke",
      performed_by: revokedBy,
      reason: reason ?? null,
    })
  }

  // -----------------------------------------------------------------------
  // getUserRoles — returns active role codes for a user
  // -----------------------------------------------------------------------

  async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = (await this.listUserRoles(
      { user_id: userId, is_active: true },
      { take: null }
    )) as any[]

    if (userRoles.length === 0) return []

    // Resolve role IDs → codes
    const roleIds = userRoles.map((ur: any) => ur.role_id)
    const roles = (await this.listRoles(
      { id: roleIds },
      { take: null }
    )) as any[]

    return roles.map((r: any) => r.code as string)
  }

  // -----------------------------------------------------------------------
  // checkPermission — does user have resource:action via any active role?
  // -----------------------------------------------------------------------

  async checkPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const perms = await this.getUserPermissions(userId)
    return perms.includes(`${resource}:${action}`)
  }

  // -----------------------------------------------------------------------
  // getUserPermissions — union of all permissions from active roles
  // -----------------------------------------------------------------------

  async getUserPermissions(userId: string): Promise<string[]> {
    const userRoles = (await this.listUserRoles(
      { user_id: userId, is_active: true },
      { take: null }
    )) as any[]

    if (userRoles.length === 0) return []

    const roleIds = userRoles.map((ur: any) => ur.role_id)
    const roles = (await this.listRoles(
      { id: roleIds },
      { take: null }
    )) as any[]

    // Collect permissions from each role's metadata.permissions array
    const permSet = new Set<string>()
    for (const role of roles) {
      const perms = (role.metadata?.permissions ?? []) as string[]
      for (const p of perms) {
        permSet.add(p)
      }
    }

    return Array.from(permSet)
  }

  // -----------------------------------------------------------------------
  // validateSsd — Static Separation of Duties check
  // -----------------------------------------------------------------------

  async validateSsd(
    rule: string,
    userId: string,
    relatedUserId: string
  ): Promise<{ valid: boolean; rule?: string; message?: string }> {
    const ssd = SSD_RULES[rule]
    if (!ssd) {
      return { valid: false, rule, message: `Unknown SSD rule: ${rule}` }
    }

    // SSD-07 is a role check, not an actor-identity check
    if (rule === "SSD-07") {
      const roles = await this.getUserRoles(userId)
      if (!roles.includes("super_admin")) {
        return { valid: false, rule, message: ssd.message }
      }
      return { valid: true }
    }

    // SSD-08 is checked during assignRole, but can also be validated standalone
    if (rule === "SSD-08") {
      const roles = await this.getUserRoles(userId)
      if (
        roles.includes("cdsco_inspector") &&
        roles.some((rc) => INTERNAL_ROLE_CODES.has(rc))
      ) {
        return { valid: false, rule, message: ssd.message }
      }
      return { valid: true }
    }

    // SSD-01 through SSD-06: the acting user must differ from the related entity actor
    if (userId === relatedUserId) {
      return { valid: false, rule, message: ssd.message }
    }

    return { valid: true }
  }

  // -----------------------------------------------------------------------
  // storeInviteRole — save intended role for a pending invite email
  // -----------------------------------------------------------------------

  async storeInviteRole(
    email: string,
    roleCode: string,
    invitedBy: string
  ): Promise<any> {
    // Remove any existing pending mapping for this email
    const existing = (await this.listInviteRoles(
      { email: email.toLowerCase() },
      { take: null }
    )) as any[]
    for (const entry of existing) {
      await this.deleteInviteRoles(entry.id)
    }

    return this.createInviteRoles({
      email: email.toLowerCase(),
      role_code: roleCode,
      invited_by: invitedBy,
    })
  }

  // -----------------------------------------------------------------------
  // consumeInviteRole — retrieve and delete pending role for an email
  // Returns the role_code if found, or the default "viewer" role
  // -----------------------------------------------------------------------

  async consumeInviteRole(email: string): Promise<string> {
    const DEFAULT_ROLE = "viewer"
    const entries = (await this.listInviteRoles(
      { email: email.toLowerCase() },
      { take: 1 }
    )) as any[]

    if (entries.length === 0) return DEFAULT_ROLE

    const entry = entries[0]
    const roleCode = entry.role_code

    // Clean up the mapping
    await this.deleteInviteRoles(entry.id)

    return roleCode
  }

  // -----------------------------------------------------------------------
  // assignDefaultRole — auto-assign role when a user is created via invite
  // -----------------------------------------------------------------------

  async assignDefaultRole(userId: string, email: string): Promise<string> {
    const roleCode = await this.consumeInviteRole(email)

    try {
      await this.assignRole(userId, roleCode, "system:invite-accepted", `Auto-assigned on invite acceptance`)
    } catch (err: any) {
      // If the specified role fails (e.g. SSD violation), fall back to viewer
      if (roleCode !== "viewer") {
        logger.warn(
          `Could not assign "${roleCode}" to ${userId}: ${err.message}. Falling back to viewer.`
        )
        await this.assignRole(userId, "viewer", "system:invite-accepted", `Fallback — original role "${roleCode}" failed: ${err.message}`)
        return "viewer"
      }
      throw err
    }

    return roleCode
  }

  // -----------------------------------------------------------------------
  // MFA — TOTP setup and verification
  // -----------------------------------------------------------------------

  /**
   * Check if a user needs MFA based on their assigned roles.
   * Resolves UserRole → Role and checks the requires_mfa flag.
   */
  async userRequiresMfa(userId: string): Promise<boolean> {
    const userRoles = (await this.listUserRoles(
      { user_id: userId, is_active: true },
      { take: null }
    )) as any[]
    if (!userRoles.length) return false

    const roleIds = userRoles.map((ur: any) => ur.role_id)
    const roles = (await this.listRoles(
      { id: roleIds },
      { take: null }
    )) as any[]

    return roles.some((r: any) => r.requires_mfa === true)
  }

  /**
   * Check if a user has completed MFA setup (has a verified secret).
   */
  async userHasMfaSetup(userId: string): Promise<boolean> {
    const secrets = await this.listMfaSecrets({ user_id: userId, is_verified: true })
    return secrets.length > 0
  }

  /**
   * Get or create a TOTP secret for a user. Returns the base32 secret for QR generation.
   */
  async getOrCreateMfaSecret(userId: string): Promise<{ secret: string; is_new: boolean }> {
    const existing = await this.listMfaSecrets({ user_id: userId })
    if (existing.length > 0) {
      return { secret: (existing[0] as any).secret, is_new: false }
    }

    const crypto = await import("crypto")
    const rawSecret = crypto.randomBytes(20)
    const base32Secret = base32Encode(rawSecret)

    await this.createMfaSecrets({
      user_id: userId,
      secret: base32Secret,
      is_verified: false,
    })

    return { secret: base32Secret, is_new: true }
  }

  /**
   * Verify a TOTP code against the user's stored secret.
   * Marks the secret as verified on first successful use.
   */
  async verifyMfaCode(userId: string, code: string): Promise<boolean> {
    const secrets = await this.listMfaSecrets({ user_id: userId })
    if (!secrets.length) return false

    const mfaRecord = secrets[0] as any
    const isValid = verifyTotp(mfaRecord.secret, code)

    if (isValid) {
      await this.updateMfaSecrets(mfaRecord.id, {
        is_verified: true,
        last_verified_at: new Date(),
      })
    }

    return isValid
  }

  // -----------------------------------------------------------------------
  // Staff Credential helpers
  // -----------------------------------------------------------------------

  /**
   * Look up a staff credential by user ID and type.
   * Returns the first matching active credential, or null.
   */
  async getCredential(
    userId: string,
    credentialType: string
  ): Promise<{ credential_value: string; holder_name: string; issuing_authority: string | null } | null> {
    const creds = (await this.listStaffCredentials(
      { user_id: userId, credential_type: credentialType },
      { take: 1 }
    )) as any[]

    if (!creds.length) return null
    return {
      credential_value: creds[0].credential_value,
      holder_name: creds[0].holder_name,
      issuing_authority: creds[0].issuing_authority,
    }
  }

  /**
   * Shorthand: get pharmacist registration number for a user.
   * Used by review-rx, dispense, H1 register, and supply memo workflows.
   */
  async getPharmacistReg(userId: string): Promise<{
    reg_no: string
    name: string
    authority: string | null
  } | null> {
    const cred = await this.getCredential(userId, "pharmacist_registration")
    if (!cred) return null
    return {
      reg_no: cred.credential_value,
      name: cred.holder_name,
      authority: cred.issuing_authority,
    }
  }

  // -----------------------------------------------------------------------
  // seedRolesAndPermissions — populate default roles + permissions
  // -----------------------------------------------------------------------

  async seedRolesAndPermissions(): Promise<void> {
    await seedRolesAndPermissions(this)
  }
}

export default RbacModuleService
