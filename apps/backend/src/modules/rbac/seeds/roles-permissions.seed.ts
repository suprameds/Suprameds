import { createLogger } from "../../../lib/logger"

/**
 * Seed script for RBAC roles, permissions, and role→permission mappings.
 *
 * Idempotent: skips any role/permission that already exists (matched by code/resource+action).
 * Permissions are stored in the role's `metadata.permissions` array as "resource:action" strings.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoleDef {
  code: string
  name: string
  description: string
  is_clinical: boolean
  requires_mfa: boolean
  metadata?: Record<string, unknown>
}

interface PermDef {
  resource: string
  action: string
  description: string
}

// ---------------------------------------------------------------------------
// Role definitions (25 roles across 5 tiers)
// ---------------------------------------------------------------------------

const ROLE_DEFS: RoleDef[] = [
  // Tier 1 — Customer
  { code: "guest", name: "Guest", description: "Unauthenticated visitor", is_clinical: false, requires_mfa: false, metadata: { tier: 1 } },
  { code: "customer", name: "Customer", description: "Registered individual buyer", is_clinical: false, requires_mfa: false, metadata: { tier: 1 } },
  { code: "b2b_buyer", name: "B2B Buyer", description: "Business buyer placing bulk orders", is_clinical: false, requires_mfa: false, metadata: { tier: 1 } },
  { code: "b2b_admin", name: "B2B Admin", description: "B2B organization administrator", is_clinical: false, requires_mfa: true, metadata: { tier: 1 } },

  // Tier 2 — Clinical
  { code: "pharmacy_technician", name: "Pharmacy Technician", description: "Assists pharmacists with non-clinical tasks", is_clinical: true, requires_mfa: true, metadata: { tier: 2 } },
  { code: "pharmacist", name: "Pharmacist", description: "Registered pharmacist — verifies Rx and dispenses", is_clinical: true, requires_mfa: true, metadata: { tier: 2 } },
  { code: "pharmacist_in_charge", name: "Pharmacist-in-Charge", description: "Senior pharmacist with H1 register and override authority", is_clinical: true, requires_mfa: true, metadata: { tier: 2 } },

  // Tier 3 — Warehouse
  { code: "grn_staff", name: "GRN Staff", description: "Creates goods-received notes", is_clinical: false, requires_mfa: false, metadata: { tier: 3 } },
  { code: "qc_staff", name: "QC Staff", description: "Inspects and approves incoming batches", is_clinical: false, requires_mfa: false, metadata: { tier: 3 } },
  { code: "picker", name: "Picker", description: "Picks items from shelves for orders", is_clinical: false, requires_mfa: false, metadata: { tier: 3 } },
  { code: "packer", name: "Packer", description: "Packs orders for dispatch", is_clinical: false, requires_mfa: false, metadata: { tier: 3 } },
  { code: "dispatch_staff", name: "Dispatch Staff", description: "Hands off packages to courier", is_clinical: false, requires_mfa: false, metadata: { tier: 3 } },
  { code: "returns_staff", name: "Returns Staff", description: "Receives and inspects returned goods", is_clinical: false, requires_mfa: false, metadata: { tier: 3 } },
  { code: "warehouse_manager", name: "Warehouse Manager", description: "Full warehouse, inventory, and batch authority", is_clinical: false, requires_mfa: true, metadata: { tier: 3 } },

  // Tier 4 — Business / Admin
  { code: "support_agent", name: "Support Agent", description: "Customer service — read-only order/customer access", is_clinical: false, requires_mfa: false, metadata: { tier: 4 } },
  { code: "support_supervisor", name: "Support Supervisor", description: "CS team lead with refund/escalation access", is_clinical: false, requires_mfa: false, metadata: { tier: 4 } },
  { code: "catalog_manager", name: "Catalog Manager", description: "Manages product catalog and batches", is_clinical: false, requires_mfa: false, metadata: { tier: 4 } },
  { code: "content_moderator", name: "Content Moderator", description: "Reviews user-generated content", is_clinical: false, requires_mfa: false, metadata: { tier: 4 } },
  { code: "marketing_admin", name: "Marketing Admin", description: "Manages promotions, loyalty, and notifications", is_clinical: false, requires_mfa: false, metadata: { tier: 4 } },
  { code: "finance_admin", name: "Finance Admin", description: "Payment, refund, and financial reporting", is_clinical: false, requires_mfa: true, metadata: { tier: 4 } },
  { code: "compliance_officer", name: "Compliance Officer", description: "Regulatory compliance, overrides, and H1 register", is_clinical: false, requires_mfa: true, metadata: { tier: 4 } },
  { code: "platform_admin", name: "Platform Admin", description: "Full platform access except super-admin operations", is_clinical: false, requires_mfa: true, metadata: { tier: 4 } },

  // Tier 5 — Elevated
  { code: "super_admin", name: "Super Admin", description: "Unrestricted system access — max 3 accounts", is_clinical: false, requires_mfa: false, metadata: { tier: 5, max_accounts: 3 } },
  { code: "cdsco_inspector", name: "CDSCO Inspector", description: "Read-only regulatory audit access — 48 h TTL", is_clinical: false, requires_mfa: true, metadata: { tier: 5, ttl_hours: 48, read_only: true } },
  { code: "supplier", name: "Supplier", description: "External supplier with PO visibility", is_clinical: false, requires_mfa: false, metadata: { tier: 5 } },

  // Viewer — default role for invited users
  { code: "viewer", name: "Viewer", description: "Read-only access to admin dashboard", is_clinical: false, requires_mfa: false, metadata: { tier: 4 } },
]

// ---------------------------------------------------------------------------
// Permission definitions (~65 meaningful resource:action pairs)
// ---------------------------------------------------------------------------

const PERM_DEFS: PermDef[] = [
  // prescription
  { resource: "prescription", action: "read", description: "View prescriptions" },
  { resource: "prescription", action: "create", description: "Upload/create prescriptions" },
  { resource: "prescription", action: "update", description: "Edit prescription metadata" },
  { resource: "prescription", action: "approve", description: "Approve a prescription" },
  { resource: "prescription", action: "reject", description: "Reject a prescription" },

  // order
  { resource: "order", action: "read", description: "View orders" },
  { resource: "order", action: "create", description: "Create manual orders" },
  { resource: "order", action: "update", description: "Update order details" },
  { resource: "order", action: "delete", description: "Cancel/delete orders" },
  { resource: "order", action: "export", description: "Export order data" },

  // product
  { resource: "product", action: "read", description: "View products" },
  { resource: "product", action: "create", description: "Add new products" },
  { resource: "product", action: "update", description: "Edit product info" },
  { resource: "product", action: "delete", description: "Remove products" },
  { resource: "product", action: "import", description: "Bulk-import products" },
  { resource: "product", action: "export", description: "Export product catalog" },

  // inventory
  { resource: "inventory", action: "read", description: "View inventory levels" },
  { resource: "inventory", action: "update", description: "Adjust inventory counts" },
  { resource: "inventory", action: "export", description: "Export inventory data" },

  // batch
  { resource: "batch", action: "read", description: "View batches" },
  { resource: "batch", action: "create", description: "Create new batches" },
  { resource: "batch", action: "update", description: "Edit batch details" },
  { resource: "batch", action: "delete", description: "Remove/recall batches" },

  // warehouse
  { resource: "warehouse", action: "read", description: "View warehouse data" },
  { resource: "warehouse", action: "update", description: "Manage warehouse settings" },

  // shipment
  { resource: "shipment", action: "read", description: "View shipments" },
  { resource: "shipment", action: "create", description: "Book shipments" },
  { resource: "shipment", action: "update", description: "Update tracking info" },

  // payment
  { resource: "payment", action: "read", description: "View payment records" },
  { resource: "payment", action: "create", description: "Process payments" },
  { resource: "payment", action: "approve", description: "Approve payment reversals" },

  // refund
  { resource: "refund", action: "read", description: "View refunds" },
  { resource: "refund", action: "create", description: "Initiate refunds" },
  { resource: "refund", action: "approve", description: "Approve refunds" },

  // customer
  { resource: "customer", action: "read", description: "View customer profiles" },
  { resource: "customer", action: "update", description: "Edit customer data" },
  { resource: "customer", action: "delete", description: "Delete/anonymize customer" },
  { resource: "customer", action: "export", description: "Export customer data" },

  // analytics
  { resource: "analytics", action: "read", description: "View dashboards/reports" },
  { resource: "analytics", action: "export", description: "Export analytics data" },

  // compliance
  { resource: "compliance", action: "read", description: "View compliance records" },
  { resource: "compliance", action: "create", description: "Create compliance entries" },
  { resource: "compliance", action: "update", description: "Update compliance records" },
  { resource: "compliance", action: "export", description: "Export compliance data" },

  // loyalty
  { resource: "loyalty", action: "read", description: "View loyalty points/tiers" },
  { resource: "loyalty", action: "create", description: "Award loyalty points" },
  { resource: "loyalty", action: "update", description: "Adjust loyalty balances" },

  // notification
  { resource: "notification", action: "read", description: "View notifications" },
  { resource: "notification", action: "create", description: "Send notifications" },

  // grn (goods received note)
  { resource: "grn", action: "read", description: "View GRNs" },
  { resource: "grn", action: "create", description: "Create GRNs" },
  { resource: "grn", action: "approve", description: "QC-approve GRNs" },

  // dispense
  { resource: "dispense", action: "read", description: "View dispense records" },
  { resource: "dispense", action: "create", description: "Create dispense entries" },
  { resource: "dispense", action: "approve", description: "Pharmacist-in-charge final approval" },

  // h1_register (Schedule H1 drug register — regulatory)
  { resource: "h1_register", action: "read", description: "View H1 register entries" },
  { resource: "h1_register", action: "create", description: "Create H1 register entries" },
  { resource: "h1_register", action: "export", description: "Export H1 register (regulatory)" },

  // override (pharmacist/compliance overrides)
  { resource: "override", action: "read", description: "View overrides" },
  { resource: "override", action: "create", description: "Create overrides" },
  { resource: "override", action: "approve", description: "Approve overrides" },

  // role & user management
  { resource: "role", action: "read", description: "View roles" },
  { resource: "role", action: "create", description: "Create roles" },
  { resource: "role", action: "update", description: "Modify roles" },
  { resource: "role", action: "delete", description: "Delete roles" },

  { resource: "user", action: "read", description: "View users" },
  { resource: "user", action: "create", description: "Create users" },
  { resource: "user", action: "update", description: "Edit users" },
  { resource: "user", action: "delete", description: "Deactivate users" },

  // purchase_order
  { resource: "purchase_order", action: "read", description: "View purchase orders" },
  { resource: "purchase_order", action: "create", description: "Create purchase orders" },
  { resource: "purchase_order", action: "approve", description: "Approve purchase orders" },

  // report
  { resource: "report", action: "read", description: "View reports" },
  { resource: "report", action: "export", description: "Export reports" },

  // content
  { resource: "content", action: "read", description: "View content" },
  { resource: "content", action: "create", description: "Create content" },
  { resource: "content", action: "update", description: "Edit content" },
  { resource: "content", action: "approve", description: "Approve content" },
  { resource: "content", action: "delete", description: "Remove content" },
]

// ---------------------------------------------------------------------------
// Role → permission mappings (stored in metadata.permissions as string[])
// ---------------------------------------------------------------------------

/** All permission codes for convenience */
const ALL_PERMS = PERM_DEFS.map((p) => `${p.resource}:${p.action}`)

/** super_admin-only operations */
const SUPER_ADMIN_ONLY = new Set([
  "role:create",
  "role:update",
  "role:delete",
  "user:create",
  "user:delete",
])

const ROLE_PERMISSIONS: Record<string, string[]> = {
  // Tier 5 — Elevated
  super_admin: ALL_PERMS,
  platform_admin: ALL_PERMS.filter((p) => !SUPER_ADMIN_ONLY.has(p)),

  // CDSCO inspector — read-only regulatory audit
  cdsco_inspector: [
    "compliance:read",
    "h1_register:read",
    "prescription:read",
    "order:read",
    "batch:read",
    "dispense:read",
  ],

  // Tier 2 — Clinical
  pharmacist: [
    "prescription:read",
    "prescription:approve",
    "prescription:reject",
    "dispense:create",
    "dispense:read",
    "h1_register:create",
    "h1_register:read",
    "order:read",
    "batch:read",
  ],
  pharmacist_in_charge: [
    "prescription:read",
    "prescription:approve",
    "prescription:reject",
    "dispense:create",
    "dispense:read",
    "dispense:approve",
    "h1_register:create",
    "h1_register:read",
    "h1_register:export",
    "order:read",
    "batch:read",
    "override:read",
    "override:approve",
    "compliance:read",
  ],
  pharmacy_technician: [
    "prescription:read",
    "dispense:read",
    "order:read",
    "batch:read",
    "h1_register:read",
  ],

  // Tier 3 — Warehouse
  warehouse_manager: [
    "warehouse:read",
    "warehouse:update",
    "inventory:read",
    "inventory:update",
    "inventory:export",
    "batch:read",
    "batch:create",
    "batch:update",
    "batch:delete",
    "grn:read",
    "grn:create",
    "grn:approve",
    "shipment:read",
    "shipment:create",
    "shipment:update",
    "purchase_order:read",
    "purchase_order:create",
    "purchase_order:approve",
  ],
  grn_staff: ["grn:create", "grn:read"],
  qc_staff: ["grn:approve", "grn:read", "batch:read"],
  picker: ["warehouse:read", "shipment:read", "order:read"],
  packer: ["warehouse:read", "shipment:read", "order:read"],
  dispatch_staff: ["warehouse:read", "shipment:read", "shipment:create", "order:read"],
  returns_staff: ["warehouse:read", "order:read", "batch:read", "inventory:read"],

  // Tier 4 — Business / Admin
  support_agent: ["order:read", "customer:read", "shipment:read", "prescription:read"],
  support_supervisor: [
    "order:read",
    "order:update",
    "customer:read",
    "customer:update",
    "shipment:read",
    "refund:read",
    "refund:create",
    "prescription:read",
  ],
  catalog_manager: [
    "product:read",
    "product:create",
    "product:update",
    "product:delete",
    "product:import",
    "product:export",
    "batch:read",
  ],
  content_moderator: [
    "content:read",
    "content:update",
    "content:approve",
    "content:delete",
  ],
  marketing_admin: [
    "loyalty:read",
    "loyalty:create",
    "loyalty:update",
    "notification:read",
    "notification:create",
    "analytics:read",
    "product:read",
  ],
  finance_admin: [
    "payment:read",
    "payment:create",
    "payment:approve",
    "refund:read",
    "refund:create",
    "refund:approve",
    "report:read",
    "report:export",
    "analytics:read",
    "analytics:export",
    "order:read",
    "order:export",
  ],
  compliance_officer: [
    "compliance:read",
    "compliance:create",
    "compliance:update",
    "compliance:export",
    "override:read",
    "override:create",
    "override:approve",
    "report:read",
    "report:export",
    "h1_register:read",
    "h1_register:export",
    "prescription:read",
    "batch:read",
  ],

  // Tier 1 — Customer (permissions handled by Medusa's built-in auth)
  guest: [],
  customer: [],
  b2b_buyer: ["order:read", "product:read", "purchase_order:read"],
  b2b_admin: [
    "order:read",
    "order:create",
    "product:read",
    "purchase_order:read",
    "purchase_order:create",
    "customer:read",
    "analytics:read",
  ],

  // Supplier — limited PO visibility
  supplier: ["purchase_order:read", "product:read", "batch:read"],

  // Viewer — read-only dashboard access (default for new invites)
  viewer: [
    "order:read",
    "product:read",
    "customer:read",
    "inventory:read",
    "analytics:read",
  ],
}

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

export async function seedRolesAndPermissions(
  rbacService: any,
  logger?: { info: (...args: any[]) => void; warn: (...args: any[]) => void }
): Promise<void> {
  const defaultLogger = createLogger("module:rbac:seed")
  const log = logger ?? { info: defaultLogger.info, warn: defaultLogger.warn }

  // --- 1. Seed permissions ------------------------------------------------

  const existingPerms = (await rbacService.listPermissions(
    {},
    { take: null }
  )) as any[]

  const existingPermCodes = new Set(
    existingPerms.map((p: any) => `${p.resource}:${p.action}`)
  )

  let permCreated = 0
  for (const perm of PERM_DEFS) {
    const code = `${perm.resource}:${perm.action}`
    if (existingPermCodes.has(code)) continue

    await rbacService.createPermissions({
      resource: perm.resource,
      action: perm.action,
      description: perm.description,
    })
    permCreated++
  }
  log.info(`[RBAC Seed] Permissions: ${permCreated} created, ${existingPerms.length} already existed`)

  // --- 2. Seed roles + attach permission codes in metadata ----------------

  const existingRoles = (await rbacService.listRoles(
    {},
    { take: null }
  )) as any[]

  const existingRoleCodes = new Set(existingRoles.map((r: any) => r.code))

  let rolesCreated = 0
  let rolesUpdated = 0
  for (const roleDef of ROLE_DEFS) {
    const permissions = ROLE_PERMISSIONS[roleDef.code] ?? []
    const metadata = {
      ...(roleDef.metadata ?? {}),
      permissions,
    }

    if (existingRoleCodes.has(roleDef.code)) {
      // Update permissions in metadata for existing roles (keeps mapping current)
      const existing = existingRoles.find((r: any) => r.code === roleDef.code)
      if (existing) {
        await rbacService.updateRoles({
          id: existing.id,
          metadata,
        })
        rolesUpdated++
      }
      continue
    }

    await rbacService.createRoles({
      name: roleDef.name,
      code: roleDef.code,
      description: roleDef.description,
      is_clinical: roleDef.is_clinical,
      requires_mfa: roleDef.requires_mfa,
      metadata,
    })
    rolesCreated++
  }

  log.info(
    `[RBAC Seed] Roles: ${rolesCreated} created, ${rolesUpdated} updated, ${existingRoles.length - rolesUpdated} unchanged`
  )
  log.info("[RBAC Seed] Complete ✓")
}
