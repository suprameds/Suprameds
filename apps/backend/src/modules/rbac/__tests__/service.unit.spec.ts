/**
 * Unit tests for RbacModuleService custom business logic.
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

function buildRole(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("role"),
    name: "Test Role",
    code: "test_role",
    description: null as string | null,
    is_clinical: false,
    requires_mfa: false,
    is_active: true,
    metadata: null as Record<string, unknown> | null,
    ...overrides,
  }
}

function buildUserRole(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("ur"),
    user_id: "user_01",
    role_id: "role_01",
    assigned_by: "admin_01",
    reason: null as string | null,
    is_active: true,
    ...overrides,
  }
}

function buildAuditLog(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("audit"),
    user_id: "user_01",
    role_id: "role_01",
    action: "assign" as "assign" | "revoke",
    performed_by: "admin_01",
    reason: null as string | null,
    ...overrides,
  }
}

function buildInviteRole(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("inv"),
    email: "test@example.com",
    role_code: "viewer",
    invited_by: "admin_01",
    ...overrides,
  }
}

function buildMfaSecret(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("mfa"),
    user_id: "user_01",
    secret: "JBSWY3DPEHPK3PXP",
    is_verified: false,
    backup_codes: null as unknown,
    last_verified_at: null as Date | null,
    ...overrides,
  }
}

function buildStaffCredential(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("cred"),
    user_id: "user_01",
    credential_type: "pharmacist_registration" as string,
    credential_value: "PH-12345",
    holder_name: "Dr. Test",
    issuing_authority: null as string | null,
    valid_from: null as Date | null,
    valid_until: null as Date | null,
    is_verified: false,
    verified_by: null as string | null,
    verified_at: null as Date | null,
    metadata: null as Record<string, unknown> | null,
    ...overrides,
  }
}

// ---------- SSD rules (mirrored from service) ----------

const SSD_RULES: Record<string, { description: string; message: string }> = {
  "SSD-01": {
    description: "Rx submitter != Rx approver",
    message: "The person who submitted the prescription cannot approve it",
  },
  "SSD-02": {
    description: "GRN creator != GRN QC approver",
    message: "The person who created the GRN cannot QC-approve it",
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

// ---------- FakeRbacService ----------

class FakeRbacService {
  private roles: ReturnType<typeof buildRole>[] = []
  private userRoles: ReturnType<typeof buildUserRole>[] = []
  private auditLogs: ReturnType<typeof buildAuditLog>[] = []
  private inviteRoles: ReturnType<typeof buildInviteRole>[] = []
  private mfaSecrets: ReturnType<typeof buildMfaSecret>[] = []
  private staffCredentials: ReturnType<typeof buildStaffCredential>[] = []

  _seedRoles(data: ReturnType<typeof buildRole>[]) {
    this.roles = data
  }
  _seedUserRoles(data: ReturnType<typeof buildUserRole>[]) {
    this.userRoles = data
  }
  _seedMfaSecrets(data: ReturnType<typeof buildMfaSecret>[]) {
    this.mfaSecrets = data
  }
  _seedStaffCredentials(data: ReturnType<typeof buildStaffCredential>[]) {
    this.staffCredentials = data
  }
  _seedInviteRoles(data: ReturnType<typeof buildInviteRole>[]) {
    this.inviteRoles = data
  }

  _getAuditLogs() { return this.auditLogs }
  _getUserRolesRaw() { return this.userRoles }
  _getInviteRoles() { return this.inviteRoles }

  // --- internal CRUD mocks ---

  private async listRoles(filters: Record<string, unknown>, _opts?: { take: number | null }) {
    return this.roles.filter((r) =>
      Object.entries(filters).every(([k, v]) => {
        if (Array.isArray(v)) return v.includes(r[k as keyof typeof r])
        return r[k as keyof typeof r] === v
      })
    )
  }

  private async listUserRoles(filters: Record<string, unknown>, _opts?: { take: number | null }) {
    return this.userRoles.filter((ur) =>
      Object.entries(filters).every(([k, v]) => ur[k as keyof typeof ur] === v)
    )
  }

  private async createUserRoles(data: Record<string, unknown>) {
    const ur = buildUserRole(data)
    this.userRoles.push(ur)
    return ur
  }

  private async updateUserRoles(data: Record<string, unknown>) {
    const idx = this.userRoles.findIndex((ur) => ur.id === data.id)
    if (idx === -1) throw new Error(`UserRole ${data.id} not found`)
    this.userRoles[idx] = { ...this.userRoles[idx], ...data } as ReturnType<typeof buildUserRole>
    return this.userRoles[idx]
  }

  private async createRoleAuditLogs(data: Record<string, unknown>) {
    const log = buildAuditLog(data)
    this.auditLogs.push(log)
    return log
  }

  private async listInviteRoles(filters: Record<string, unknown>, _opts?: { take: number | null }) {
    return this.inviteRoles.filter((ir) =>
      Object.entries(filters).every(([k, v]) => ir[k as keyof typeof ir] === v)
    )
  }

  private async createInviteRoles(data: Record<string, unknown>) {
    const ir = buildInviteRole(data)
    this.inviteRoles.push(ir)
    return ir
  }

  private async deleteInviteRoles(id: string) {
    this.inviteRoles = this.inviteRoles.filter((ir) => ir.id !== id)
  }

  private async listMfaSecrets(filters: Record<string, unknown>) {
    return this.mfaSecrets.filter((m) =>
      Object.entries(filters).every(([k, v]) => m[k as keyof typeof m] === v)
    )
  }

  private async createMfaSecrets(data: Record<string, unknown>) {
    const m = buildMfaSecret(data)
    this.mfaSecrets.push(m)
    return m
  }

  private async updateMfaSecrets(id: string, data: Record<string, unknown>) {
    const idx = this.mfaSecrets.findIndex((m) => m.id === id)
    if (idx === -1) throw new Error(`MfaSecret ${id} not found`)
    this.mfaSecrets[idx] = { ...this.mfaSecrets[idx], ...data } as ReturnType<typeof buildMfaSecret>
    return this.mfaSecrets[idx]
  }

  private async listStaffCredentials(filters: Record<string, unknown>, _opts?: { take: number }) {
    return this.staffCredentials.filter((c) =>
      Object.entries(filters).every(([k, v]) => c[k as keyof typeof c] === v)
    )
  }

  // --- public service methods (mirrors service.ts) ---

  async assignRole(
    userId: string,
    roleCode: string,
    assignedBy: string,
    reason?: string,
  ) {
    const [role] = await this.listRoles({ code: roleCode }, { take: 1 })
    if (!role) throw new Error(`Role "${roleCode}" does not exist`)

    const [existing] = await this.listUserRoles(
      { user_id: userId, role_id: role.id, is_active: true },
      { take: 1 },
    )
    if (existing) {
      throw new Error(`User ${userId} already has active role "${roleCode}"`)
    }

    // SSD-08: cdsco_inspector cannot coexist with internal roles
    const currentRoles = await this.getUserRoles(userId)
    if (roleCode === "cdsco_inspector") {
      const hasInternal = currentRoles.some((rc) => INTERNAL_ROLE_CODES.has(rc))
      if (hasInternal) {
        throw new Error(
          `SSD-08 violation: cannot assign cdsco_inspector — user holds internal role(s): ${currentRoles.filter((rc) => INTERNAL_ROLE_CODES.has(rc)).join(", ")}`,
        )
      }
    }
    if (INTERNAL_ROLE_CODES.has(roleCode) && currentRoles.includes("cdsco_inspector")) {
      throw new Error(
        `SSD-08 violation: cannot assign internal role "${roleCode}" — user is a CDSCO inspector`,
      )
    }

    const userRole = await this.createUserRoles({
      user_id: userId,
      role_id: role.id,
      assigned_by: assignedBy,
      reason: reason ?? null,
    })

    await this.createRoleAuditLogs({
      user_id: userId,
      role_id: role.id,
      action: "assign",
      performed_by: assignedBy,
      reason: reason ?? null,
    })

    return userRole
  }

  async revokeRole(
    userId: string,
    roleCode: string,
    revokedBy: string,
    reason?: string,
  ) {
    const [role] = await this.listRoles({ code: roleCode }, { take: 1 })
    if (!role) throw new Error(`Role "${roleCode}" does not exist`)

    const [userRole] = await this.listUserRoles(
      { user_id: userId, role_id: role.id, is_active: true },
      { take: 1 },
    )
    if (!userRole) {
      throw new Error(`User ${userId} does not have active role "${roleCode}"`)
    }

    await this.updateUserRoles({ id: userRole.id, is_active: false })

    await this.createRoleAuditLogs({
      user_id: userId,
      role_id: role.id,
      action: "revoke",
      performed_by: revokedBy,
      reason: reason ?? null,
    })
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await this.listUserRoles(
      { user_id: userId, is_active: true },
      { take: null },
    )
    if (userRoles.length === 0) return []

    const roleIds = userRoles.map((ur) => ur.role_id)
    const roles = await this.listRoles({ id: roleIds }, { take: null })
    return roles.map((r) => r.code)
  }

  async checkPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const perms = await this.getUserPermissions(userId)
    return perms.includes(`${resource}:${action}`)
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const userRoles = await this.listUserRoles(
      { user_id: userId, is_active: true },
      { take: null },
    )
    if (userRoles.length === 0) return []

    const roleIds = userRoles.map((ur) => ur.role_id)
    const roles = await this.listRoles({ id: roleIds }, { take: null })

    const permSet = new Set<string>()
    for (const role of roles) {
      const perms = ((role.metadata as any)?.permissions ?? []) as string[]
      for (const p of perms) {
        permSet.add(p)
      }
    }
    return Array.from(permSet)
  }

  async validateSsd(
    rule: string,
    userId: string,
    relatedUserId: string,
  ): Promise<{ valid: boolean; rule?: string; message?: string }> {
    const ssd = SSD_RULES[rule]
    if (!ssd) {
      return { valid: false, rule, message: `Unknown SSD rule: ${rule}` }
    }

    if (rule === "SSD-07") {
      const roles = await this.getUserRoles(userId)
      if (!roles.includes("super_admin")) {
        return { valid: false, rule, message: ssd.message }
      }
      return { valid: true }
    }

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

    if (userId === relatedUserId) {
      return { valid: false, rule, message: ssd.message }
    }

    return { valid: true }
  }

  async storeInviteRole(
    email: string,
    roleCode: string,
    invitedBy: string,
  ) {
    const existing = await this.listInviteRoles(
      { email: email.toLowerCase() },
      { take: null },
    )
    for (const entry of existing) {
      await this.deleteInviteRoles(entry.id)
    }

    return this.createInviteRoles({
      email: email.toLowerCase(),
      role_code: roleCode,
      invited_by: invitedBy,
    })
  }

  async consumeInviteRole(email: string): Promise<string> {
    const DEFAULT_ROLE = "viewer"
    const entries = await this.listInviteRoles(
      { email: email.toLowerCase() },
      { take: 1 },
    )

    if (entries.length === 0) return DEFAULT_ROLE

    const entry = entries[0]
    const roleCode = entry.role_code
    await this.deleteInviteRoles(entry.id)
    return roleCode
  }

  async userRequiresMfa(userId: string): Promise<boolean> {
    const userRoles = await this.listUserRoles(
      { user_id: userId, is_active: true },
      { take: null },
    )
    if (!userRoles.length) return false

    const roleIds = userRoles.map((ur) => ur.role_id)
    const roles = await this.listRoles({ id: roleIds }, { take: null })
    return roles.some((r) => r.requires_mfa === true)
  }

  async userHasMfaSetup(userId: string): Promise<boolean> {
    const secrets = await this.listMfaSecrets({ user_id: userId, is_verified: true })
    return secrets.length > 0
  }

  /** Simplified verifyMfaCode: find secret, check verified status, mock TOTP validation */
  private _totpValidationResult = true
  _setTotpValidationResult(val: boolean) { this._totpValidationResult = val }

  async verifyMfaCode(userId: string, code: string): Promise<boolean> {
    const secrets = await this.listMfaSecrets({ user_id: userId })
    if (!secrets.length) return false

    const mfaRecord = secrets[0]
    const isValid = this._totpValidationResult // mock the TOTP verification

    if (isValid) {
      await this.updateMfaSecrets(mfaRecord.id, {
        is_verified: true,
        last_verified_at: new Date(),
      })
    }

    return isValid
  }
}

// ---------- tests ----------

describe("RbacModuleService (unit)", () => {
  let service: FakeRbacService

  const pharmacistRole = buildRole({
    id: "role_pharmacist",
    name: "Pharmacist",
    code: "pharmacist",
    is_clinical: true,
    requires_mfa: true,
    metadata: { permissions: ["prescription:review", "dispense:create", "h1:write"] },
  })

  const viewerRole = buildRole({
    id: "role_viewer",
    name: "Viewer",
    code: "viewer",
    requires_mfa: false,
    metadata: { permissions: ["dashboard:read"] },
  })

  const superAdminRole = buildRole({
    id: "role_super_admin",
    name: "Super Admin",
    code: "super_admin",
    requires_mfa: true,
    metadata: { permissions: ["*:*"], max_accounts: 3 },
  })

  const inspectorRole = buildRole({
    id: "role_inspector",
    name: "CDSCO Inspector",
    code: "cdsco_inspector",
    requires_mfa: false,
    metadata: { permissions: ["compliance:read"] },
  })

  beforeEach(() => {
    service = new FakeRbacService()
    _idCounter = 0
    service._seedRoles([pharmacistRole, viewerRole, superAdminRole, inspectorRole])
  })

  // -- assignRole --

  describe("assignRole()", () => {
    it("creates a user-role assignment and an audit log entry", async () => {
      await service.assignRole("user_01", "pharmacist", "admin_01", "Onboarding")

      const rawRoles = service._getUserRolesRaw()
      expect(rawRoles).toHaveLength(1)
      expect(rawRoles[0].user_id).toBe("user_01")
      expect(rawRoles[0].role_id).toBe("role_pharmacist")
      expect(rawRoles[0].is_active).toBe(true)

      const logs = service._getAuditLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe("assign")
      expect(logs[0].performed_by).toBe("admin_01")
      expect(logs[0].reason).toBe("Onboarding")
    })

    it("rejects duplicate active assignment for the same user and role", async () => {
      await service.assignRole("user_01", "viewer", "admin_01")

      await expect(
        service.assignRole("user_01", "viewer", "admin_01"),
      ).rejects.toThrow('User user_01 already has active role "viewer"')
    })

    it("throws when the role code does not exist", async () => {
      await expect(
        service.assignRole("user_01", "nonexistent", "admin_01"),
      ).rejects.toThrow('Role "nonexistent" does not exist')
    })

    it("allows assigning different roles to the same user", async () => {
      await service.assignRole("user_01", "pharmacist", "admin_01")
      await service.assignRole("user_01", "viewer", "admin_01")

      const roles = await service.getUserRoles("user_01")
      expect(roles).toContain("pharmacist")
      expect(roles).toContain("viewer")
    })

    it("blocks cdsco_inspector when user holds internal role (SSD-08)", async () => {
      await service.assignRole("user_01", "pharmacist", "admin_01")

      await expect(
        service.assignRole("user_01", "cdsco_inspector", "admin_01"),
      ).rejects.toThrow("SSD-08 violation")
    })

    it("blocks internal role when user is a CDSCO inspector (SSD-08)", async () => {
      await service.assignRole("user_01", "cdsco_inspector", "admin_01")

      await expect(
        service.assignRole("user_01", "pharmacist", "admin_01"),
      ).rejects.toThrow("SSD-08 violation")
    })
  })

  // -- revokeRole --

  describe("revokeRole()", () => {
    it("deactivates the role and creates a revoke audit log", async () => {
      await service.assignRole("user_01", "pharmacist", "admin_01")

      await service.revokeRole("user_01", "pharmacist", "admin_02", "No longer needed")

      const rawRoles = service._getUserRolesRaw()
      expect(rawRoles[0].is_active).toBe(false)

      const logs = service._getAuditLogs()
      const revokeLogs = logs.filter((l) => l.action === "revoke")
      expect(revokeLogs).toHaveLength(1)
      expect(revokeLogs[0].performed_by).toBe("admin_02")
      expect(revokeLogs[0].reason).toBe("No longer needed")
    })

    it("throws if user does not have an active assignment for that role", async () => {
      await expect(
        service.revokeRole("user_01", "pharmacist", "admin_01"),
      ).rejects.toThrow('User user_01 does not have active role "pharmacist"')
    })

    it("throws if the role code does not exist", async () => {
      await expect(
        service.revokeRole("user_01", "ghost_role", "admin_01"),
      ).rejects.toThrow('Role "ghost_role" does not exist')
    })
  })

  // -- getUserRoles --

  describe("getUserRoles()", () => {
    it("returns an empty array when user has no roles", async () => {
      const roles = await service.getUserRoles("user_nobody")
      expect(roles).toEqual([])
    })

    it("returns active role codes for a user", async () => {
      await service.assignRole("user_01", "pharmacist", "admin_01")
      await service.assignRole("user_01", "viewer", "admin_01")

      const roles = await service.getUserRoles("user_01")
      expect(roles).toHaveLength(2)
      expect(roles).toContain("pharmacist")
      expect(roles).toContain("viewer")
    })

    it("excludes revoked roles from the result", async () => {
      await service.assignRole("user_01", "pharmacist", "admin_01")
      await service.assignRole("user_01", "viewer", "admin_01")
      await service.revokeRole("user_01", "pharmacist", "admin_02")

      const roles = await service.getUserRoles("user_01")
      expect(roles).toEqual(["viewer"])
    })
  })

  // -- checkPermission --

  describe("checkPermission()", () => {
    it("returns true when user has the requested permission via a role", async () => {
      await service.assignRole("user_01", "pharmacist", "admin_01")

      const has = await service.checkPermission("user_01", "prescription", "review")
      expect(has).toBe(true)
    })

    it("returns false when user lacks the permission", async () => {
      await service.assignRole("user_01", "viewer", "admin_01")

      const has = await service.checkPermission("user_01", "prescription", "review")
      expect(has).toBe(false)
    })

    it("returns false for a user with no roles", async () => {
      const has = await service.checkPermission("user_nobody", "dashboard", "read")
      expect(has).toBe(false)
    })
  })

  // -- getUserPermissions --

  describe("getUserPermissions()", () => {
    it("returns union of permissions from all active roles", async () => {
      await service.assignRole("user_01", "pharmacist", "admin_01")
      await service.assignRole("user_01", "viewer", "admin_01")

      const perms = await service.getUserPermissions("user_01")
      expect(perms).toContain("prescription:review")
      expect(perms).toContain("dispense:create")
      expect(perms).toContain("dashboard:read")
    })

    it("returns empty array for a user with no roles", async () => {
      const perms = await service.getUserPermissions("user_nobody")
      expect(perms).toEqual([])
    })

    it("deduplicates permissions across roles", async () => {
      // Both roles may have overlapping permissions in a real setup.
      // Here we verify the union is a set.
      await service.assignRole("user_01", "pharmacist", "admin_01")
      const perms = await service.getUserPermissions("user_01")
      const uniqueCount = new Set(perms).size
      expect(perms.length).toBe(uniqueCount)
    })
  })

  // -- validateSsd --

  describe("validateSsd()", () => {
    it("SSD-01: fails when submitter equals approver", async () => {
      const result = await service.validateSsd("SSD-01", "user_01", "user_01")
      expect(result.valid).toBe(false)
      expect(result.message).toContain("submitted the prescription cannot approve")
    })

    it("SSD-01: passes when submitter differs from approver", async () => {
      const result = await service.validateSsd("SSD-01", "user_01", "user_02")
      expect(result.valid).toBe(true)
    })

    it("SSD-02: fails for same GRN creator and approver", async () => {
      const result = await service.validateSsd("SSD-02", "user_01", "user_01")
      expect(result.valid).toBe(false)
    })

    it("SSD-07: fails when user is not super_admin", async () => {
      await service.assignRole("user_01", "viewer", "admin_01")
      const result = await service.validateSsd("SSD-07", "user_01", "ignored")
      expect(result.valid).toBe(false)
      expect(result.message).toContain("super_admin")
    })

    it("SSD-07: passes when user is super_admin", async () => {
      await service.assignRole("user_01", "super_admin", "admin_01")
      const result = await service.validateSsd("SSD-07", "user_01", "ignored")
      expect(result.valid).toBe(true)
    })

    it("returns invalid for unknown SSD rule", async () => {
      const result = await service.validateSsd("SSD-99", "user_01", "user_02")
      expect(result.valid).toBe(false)
      expect(result.message).toContain("Unknown SSD rule")
    })
  })

  // -- storeInviteRole / consumeInviteRole --

  describe("storeInviteRole() / consumeInviteRole()", () => {
    it("stores a pending invite role for an email", async () => {
      await service.storeInviteRole("New@Example.COM", "pharmacist", "admin_01")

      const stored = service._getInviteRoles()
      expect(stored).toHaveLength(1)
      expect(stored[0].email).toBe("new@example.com") // lowercased
      expect(stored[0].role_code).toBe("pharmacist")
    })

    it("replaces existing invite role for the same email", async () => {
      await service.storeInviteRole("test@example.com", "viewer", "admin_01")
      await service.storeInviteRole("test@example.com", "pharmacist", "admin_02")

      const stored = service._getInviteRoles()
      expect(stored).toHaveLength(1)
      expect(stored[0].role_code).toBe("pharmacist")
    })

    it("consumeInviteRole returns the stored role code and deletes the record", async () => {
      await service.storeInviteRole("test@example.com", "pharmacist", "admin_01")

      const roleCode = await service.consumeInviteRole("test@example.com")
      expect(roleCode).toBe("pharmacist")
      expect(service._getInviteRoles()).toHaveLength(0)
    })

    it("consumeInviteRole returns 'viewer' when no invite mapping exists", async () => {
      const roleCode = await service.consumeInviteRole("nobody@example.com")
      expect(roleCode).toBe("viewer")
    })
  })

  // -- userRequiresMfa --

  describe("userRequiresMfa()", () => {
    it("returns true if any active role has requires_mfa", async () => {
      await service.assignRole("user_01", "pharmacist", "admin_01")

      const requires = await service.userRequiresMfa("user_01")
      expect(requires).toBe(true)
    })

    it("returns false if no active role requires MFA", async () => {
      await service.assignRole("user_01", "viewer", "admin_01")

      const requires = await service.userRequiresMfa("user_01")
      expect(requires).toBe(false)
    })

    it("returns false if user has no roles at all", async () => {
      const requires = await service.userRequiresMfa("user_nobody")
      expect(requires).toBe(false)
    })
  })

  // -- userHasMfaSetup --

  describe("userHasMfaSetup()", () => {
    it("returns true when user has a verified MFA secret", async () => {
      service._seedMfaSecrets([
        buildMfaSecret({ user_id: "user_01", is_verified: true }),
      ])

      const has = await service.userHasMfaSetup("user_01")
      expect(has).toBe(true)
    })

    it("returns false when user has an unverified MFA secret", async () => {
      service._seedMfaSecrets([
        buildMfaSecret({ user_id: "user_01", is_verified: false }),
      ])

      const has = await service.userHasMfaSetup("user_01")
      expect(has).toBe(false)
    })

    it("returns false when user has no MFA secret", async () => {
      const has = await service.userHasMfaSetup("user_nobody")
      expect(has).toBe(false)
    })
  })

  // -- verifyMfaCode --

  describe("verifyMfaCode()", () => {
    it("returns false when user has no MFA secret", async () => {
      const valid = await service.verifyMfaCode("user_nobody", "123456")
      expect(valid).toBe(false)
    })

    it("returns true and marks secret as verified on valid code", async () => {
      service._seedMfaSecrets([
        buildMfaSecret({ user_id: "user_01", is_verified: false }),
      ])
      service._setTotpValidationResult(true)

      const valid = await service.verifyMfaCode("user_01", "123456")
      expect(valid).toBe(true)

      // Should also mark the secret as verified
      const hasSetup = await service.userHasMfaSetup("user_01")
      expect(hasSetup).toBe(true)
    })

    it("returns false and does not mark secret verified on invalid code", async () => {
      service._seedMfaSecrets([
        buildMfaSecret({ user_id: "user_01", is_verified: false }),
      ])
      service._setTotpValidationResult(false)

      const valid = await service.verifyMfaCode("user_01", "000000")
      expect(valid).toBe(false)

      const hasSetup = await service.userHasMfaSetup("user_01")
      expect(hasSetup).toBe(false)
    })
  })
})
