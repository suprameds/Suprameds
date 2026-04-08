import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Tabs,
  Text,
  toast,
} from "@medusajs/ui"
import { ArrowPath, CheckCircleSolid, EnvelopeSolid, LockClosedSolid, MagnifyingGlass, PlusMini, User, XCircleSolid, XMark } from "@medusajs/icons"
import { useCallback, useEffect, useMemo, useState } from "react"
import { sdk } from "../../lib/client"

// ── Types ─────────────────────────────────────────────────────────────────────

type RoleDefinition = {
  code: string
  name: string
  tier: number
  clinical: boolean
  mfa_required: boolean
  description: string
  active_users_count: number
  permissions: string[]
}

type UserWithRoles = {
  user_id: string
  email: string | null
  roles: { role_code: string; assigned_at: string }[]
}

type AuditEntry = {
  id: string
  user_id: string
  user_email: string | null
  role_code: string
  role_name: string
  action: "assign" | "revoke"
  performed_by: string
  reason: string
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const tierLabel = (tier: number): string => {
  const labels: Record<number, string> = {
    1: "Tier 1 - Platform Admin",
    2: "Tier 2 - Compliance / Clinical",
    3: "Tier 3 - Operations",
    4: "Tier 4 - Customer-Facing",
    5: "Tier 5 - External / System",
  }
  return labels[tier] ?? `Tier ${tier}`
}

const tierBadgeColor = (tier: number): "red" | "purple" | "blue" | "orange" | "grey" => {
  const map: Record<number, "red" | "purple" | "blue" | "orange" | "grey"> = {
    1: "red",
    2: "purple",
    3: "blue",
    4: "orange",
    5: "grey",
  }
  return map[tier] ?? "grey"
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard = ({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) => (
  <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-base">
    <Text className="text-xs text-ui-fg-subtle uppercase tracking-wide">
      {label}
    </Text>
    <Text className="text-2xl font-semibold mt-1">{value}</Text>
    {sub && (
      <Text className="text-xs text-ui-fg-muted mt-0.5">{sub}</Text>
    )}
  </div>
)

// ── Seed Roles Prompt ─────────────────────────────────────────────────────────

const SeedRolesPrompt = ({ onSeeded }: { onSeeded: () => void }) => {
  const [seeding, setSeeding] = useState(false)

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await sdk.client.fetch<{ message: string }>("/admin/rbac/seed", {
        method: "POST",
      })
      toast.success("Roles and permissions seeded successfully!")
      onSeeded()
    } catch (err: any) {
      toast.error("Failed to seed roles", { description: err.message })
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <LockClosedSolid className="w-10 h-10 text-ui-fg-muted" />
      <Heading level="h2" className="text-lg">
        No roles found
      </Heading>
      <Text className="text-ui-fg-subtle text-center max-w-md">
        The RBAC system hasn't been initialized yet. Click below to seed
        25 predefined roles and ~65 permissions for the Suprameds platform.
      </Text>
      <Button
        variant="primary"
        disabled={seeding}
        onClick={handleSeed}
      >
        {seeding ? "Seeding..." : "Initialize Roles & Permissions"}
      </Button>
    </div>
  )
}

// ── My Role Card ──────────────────────────────────────────────────────────────

type MyCredentialInfo = {
  id: string
  credential_type: string
  credential_value: string
  holder_name: string
  issuing_authority: string | null
  is_verified: boolean
}

type MyRoleInfo = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  roles: {
    code: string
    name: string
    tier: number
    clinical: boolean
    mfa_required: boolean
    assigned_at: string
    permissions: string[]
  }[]
  permissions: string[]
  credentials: MyCredentialInfo[]
}

const MyRoleCard = () => {
  const [me, setMe] = useState<MyRoleInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPerms, setShowPerms] = useState(false)

  useEffect(() => {
    sdk.client
      .fetch<MyRoleInfo>("/admin/rbac/me")
      .then((data) => setMe(data))
      .catch((err) => console.error("[rbac-me]", err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Container className="p-5">
        <Text className="text-ui-fg-subtle">Loading your profile...</Text>
      </Container>
    )
  }

  if (!me) return null

  const displayName =
    [me.first_name, me.last_name].filter(Boolean).join(" ") || me.email || me.user_id

  return (
    <Container className="p-5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-ui-bg-subtle flex items-center justify-center">
          <User className="w-6 h-6 text-ui-fg-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Text className="text-sm font-semibold">{displayName}</Text>
            {me.email && displayName !== me.email && (
              <Text className="text-xs text-ui-fg-muted">{me.email}</Text>
            )}
          </div>

          {me.roles.length === 0 ? (
            <Text className="text-sm text-ui-fg-muted">No roles assigned</Text>
          ) : (
            <div className="flex flex-wrap gap-2 mb-2">
              {me.roles.map((role) => (
                <div key={role.code} className="flex items-center gap-1.5">
                  <Badge color={tierBadgeColor(role.tier)}>{role.name}</Badge>
                  {role.clinical && (
                    <Badge color="blue" className="text-[10px]">Clinical</Badge>
                  )}
                  {role.mfa_required && (
                    <Badge color="purple" className="text-[10px]">MFA</Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Text className="text-xs text-ui-fg-muted">
              {me.permissions.length} permission(s) across {me.roles.length} role(s)
            </Text>
            {me.permissions.length > 0 && (
              <button
                type="button"
                className="text-xs text-ui-fg-interactive underline hover:text-ui-fg-interactive-hover"
                onClick={() => setShowPerms(!showPerms)}
              >
                {showPerms ? "Hide permissions" : "View permissions"}
              </button>
            )}
          </div>

          {showPerms && (
            <div className="mt-3 flex flex-wrap gap-1">
              {me.permissions.map((perm) => (
                <Badge key={perm} color="grey" className="text-[10px]">
                  {perm}
                </Badge>
              ))}
            </div>
          )}

          {me.credentials && me.credentials.length > 0 && (
            <div className="mt-3 pt-3 border-t border-ui-border-base">
              <Text className="text-xs text-ui-fg-subtle mb-1.5">Professional Credentials</Text>
              <div className="flex flex-wrap gap-2">
                {me.credentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-ui-border-base bg-ui-bg-subtle text-xs"
                  >
                    <span className="font-medium">{cred.credential_type.replace(/_/g, " ")}:</span>
                    <span className="font-mono">{cred.credential_value}</span>
                    {cred.is_verified ? (
                      <Badge color="green" className="text-[9px]">Verified</Badge>
                    ) : (
                      <Badge color="orange" className="text-[9px]">Unverified</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Container>
  )
}

// ── Roles Overview Tab ────────────────────────────────────────────────────────

const RolesOverviewTab = () => {
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerUsers, setDrawerUsers] = useState<UserWithRoles[]>([])
  const [drawerUsersLoading, setDrawerUsersLoading] = useState(false)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const json = await sdk.client.fetch<{ roles: RoleDefinition[] }>("/admin/rbac/roles")
      setRoles(json.roles ?? [])
    } catch (err) {
      console.error("[rbac-roles]", err)
      toast.error("Failed to load roles")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const openRoleDrawer = async (role: RoleDefinition) => {
    setSelectedRole(role)
    setDrawerOpen(true)
    setDrawerUsersLoading(true)
    try {
      const json = await sdk.client.fetch<{ users: UserWithRoles[] }>(
        "/admin/rbac/users",
        { query: { role_code: role.code } }
      )
      setDrawerUsers(json.users ?? [])
    } catch (err) {
      console.error("[rbac-role-users]", err)
      toast.error("Failed to load users for this role")
      setDrawerUsers([])
    } finally {
      setDrawerUsersLoading(false)
    }
  }

  // Group roles by tier
  const rolesByTier = roles.reduce<Record<number, RoleDefinition[]>>(
    (acc, role) => {
      if (!acc[role.tier]) acc[role.tier] = []
      acc[role.tier].push(role)
      return acc
    },
    {}
  )

  const totalUsers = roles.reduce((sum, r) => sum + r.active_users_count, 0)
  const clinicalCount = roles.filter((r) => r.clinical).length
  const mfaCount = roles.filter((r) => r.mfa_required).length

  return (
    <div className="flex flex-col gap-4">
      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Total Roles" value={roles.length} sub="Defined in RBAC matrix" />
        <StatCard label="Active Users" value={totalUsers} sub="Across all roles" />
        <StatCard label="Clinical Roles" value={clinicalCount} sub="Require pharmacist credentials" />
        <StatCard label="MFA Required" value={mfaCount} sub="Roles enforcing MFA" />
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" size="small" onClick={fetchRoles}>
          <ArrowPath />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading roles...</Text>
      ) : roles.length === 0 ? (
        <SeedRolesPrompt onSeeded={fetchRoles} />
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(rolesByTier)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([tier, tierRoles]) => (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge color={tierBadgeColor(Number(tier))}>
                    {tierLabel(Number(tier))}
                  </Badge>
                  <Text className="text-xs text-ui-fg-muted">
                    {tierRoles.length} role(s)
                  </Text>
                </div>

                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Name</Table.HeaderCell>
                      <Table.HeaderCell>Code</Table.HeaderCell>
                      <Table.HeaderCell>Tier</Table.HeaderCell>
                      <Table.HeaderCell>Clinical</Table.HeaderCell>
                      <Table.HeaderCell>MFA Required</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Active Users</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {tierRoles.map((role) => (
                      <Table.Row
                        key={role.code}
                        className="cursor-pointer hover:bg-ui-bg-subtle-hover"
                        onClick={() => openRoleDrawer(role)}
                      >
                        <Table.Cell>
                          <Text className="text-sm font-medium">{role.name}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text className="text-sm font-mono text-ui-fg-subtle">
                            {role.code}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge color={tierBadgeColor(role.tier)}>
                            Tier {role.tier}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          {role.clinical ? (
                            <Badge color="blue">Clinical</Badge>
                          ) : (
                            <Text className="text-sm text-ui-fg-muted">--</Text>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          {role.mfa_required ? (
                            <Badge color="purple">MFA</Badge>
                          ) : (
                            <Text className="text-sm text-ui-fg-muted">--</Text>
                          )}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {role.active_users_count > 0 ? (
                            <Badge color="green">{role.active_users_count}</Badge>
                          ) : (
                            <Text className="text-sm text-ui-fg-muted">0</Text>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            ))}
        </div>
      )}

      {/* Role detail drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content className="!max-w-[700px]">
          <Drawer.Header>
            <Drawer.Title>
              {selectedRole?.name ?? "Role Details"}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4 overflow-y-auto">
            {!selectedRole ? (
              <Text className="text-ui-fg-subtle">No role selected.</Text>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Role metadata */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">Code</Text>
                    <Text className="font-mono font-medium">{selectedRole.code}</Text>
                  </div>
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">Tier</Text>
                    <Badge color={tierBadgeColor(selectedRole.tier)}>
                      {tierLabel(selectedRole.tier)}
                    </Badge>
                  </div>
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">Clinical</Text>
                    {selectedRole.clinical ? (
                      <Badge color="blue">Yes - Requires pharmacist credentials</Badge>
                    ) : (
                      <Text>No</Text>
                    )}
                  </div>
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">MFA Required</Text>
                    {selectedRole.mfa_required ? (
                      <Badge color="purple">Yes</Badge>
                    ) : (
                      <Text>No</Text>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Text className="text-xs text-ui-fg-subtle mb-1">Description</Text>
                  <Text className="text-sm">{selectedRole.description || "No description provided."}</Text>
                </div>

                {/* Permissions */}
                {selectedRole.permissions && selectedRole.permissions.length > 0 && (
                  <div>
                    <Text className="text-xs text-ui-fg-subtle mb-2">
                      Permissions ({selectedRole.permissions.length})
                    </Text>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRole.permissions.map((perm) => (
                        <Badge key={perm} color="grey">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assigned users */}
                <div>
                  <Text className="text-sm font-medium mb-2">
                    Assigned Users ({selectedRole.active_users_count})
                  </Text>
                  {drawerUsersLoading ? (
                    <Text className="text-ui-fg-subtle text-sm">Loading users...</Text>
                  ) : drawerUsers.length === 0 ? (
                    <Text className="text-ui-fg-subtle text-sm">
                      No users assigned to this role.
                    </Text>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-ui-bg-subtle text-left text-xs text-ui-fg-subtle">
                            <th className="py-2 px-3">User ID</th>
                            <th className="py-2 px-3">Email</th>
                            <th className="py-2 px-3">Assigned At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drawerUsers.map((u) => (
                            <tr key={u.user_id} className="border-b last:border-b-0">
                              <td className="py-2 px-3 font-mono text-xs">
                                {u.user_id.slice(-12)}
                              </td>
                              <td className="py-2 px-3">
                                {u.email ?? "--"}
                              </td>
                              <td className="py-2 px-3 text-ui-fg-subtle">
                                {u.roles
                                  .filter((r) => r.role_code === selectedRole.code)
                                  .map((r) => fmtDateTime(r.assigned_at))
                                  .join(", ") || "--"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Close</Button>
            </Drawer.Close>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

// ── User Roles Tab ────────────────────────────────────────────────────────────

const UserRolesTab = () => {
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState("")

  // Assign drawer state
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignUserId, setAssignUserId] = useState("")
  const [assignRoleCode, setAssignRoleCode] = useState("")
  const [assignReason, setAssignReason] = useState("")
  const [assigning, setAssigning] = useState(false)

  // Revoke in-progress
  const [revoking, setRevoking] = useState<string | null>(null)

  const fetchRoles = useCallback(async () => {
    try {
      const json = await sdk.client.fetch<{ roles: RoleDefinition[] }>("/admin/rbac/roles")
      setRoles(json.roles ?? [])
    } catch {
      // Non-critical
    }
  }, [])

  const fetchUsers = useCallback(async (query?: string) => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: "100" }
      if (query?.trim()) params.search = query.trim()

      const json = await sdk.client.fetch<{ users: UserWithRoles[] }>(
        "/admin/rbac/users",
        { query: params }
      )
      setUsers(json.users ?? [])
    } catch (err) {
      console.error("[rbac-users]", err)
      toast.error("Failed to load users")
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
    fetchUsers()
  }, [fetchRoles, fetchUsers])

  // Filter users client-side for instant search
  const filteredUsers = useMemo(() => {
    if (!searchText.trim()) return users
    const q = searchText.toLowerCase()
    return users.filter(
      (u) =>
        u.user_id.toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false)
    )
  }, [users, searchText])

  const handleAssign = async () => {
    if (!assignUserId || !assignRoleCode) {
      toast.error("User and Role are required")
      return
    }
    setAssigning(true)
    try {
      await sdk.client.fetch<{ success: boolean }>("/admin/rbac/assign", {
        method: "POST",
        body: {
          user_id: assignUserId,
          role_code: assignRoleCode,
          reason: assignReason.trim() || undefined,
        },
      })
      toast.success("Role assigned successfully")
      setAssignOpen(false)
      setAssignUserId("")
      setAssignRoleCode("")
      setAssignReason("")
      fetchUsers()
    } catch (err: any) {
      toast.error("Failed to assign role", { description: err.message })
    } finally {
      setAssigning(false)
    }
  }

  const handleRevoke = async (userId: string, roleCode: string) => {
    const revokeKey = `${userId}:${roleCode}`
    setRevoking(revokeKey)
    try {
      await sdk.client.fetch<{ success: boolean }>("/admin/rbac/revoke", {
        method: "POST",
        body: {
          user_id: userId,
          role_code: roleCode,
          reason: "Revoked via admin UI",
        },
      })
      toast.success("Role revoked")
      fetchUsers()
    } catch (err: any) {
      toast.error("Failed to revoke role", { description: err.message })
    } finally {
      setRevoking(null)
    }
  }

  const getRoleName = (code: string): string => {
    const role = roles.find((r) => r.code === code)
    return role?.name ?? code
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar + Assign button */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[250px] max-w-[400px]">
          <Text className="text-xs text-ui-fg-subtle mb-1">
            Filter by user ID or email
          </Text>
          <Input
            placeholder="Type to filter users..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <Button variant="secondary" size="small" onClick={() => fetchUsers()}>
          <ArrowPath />
          Refresh
        </Button>
        <div className="ml-auto">
          <Button
            variant="primary"
            size="small"
            onClick={() => setAssignOpen(true)}
          >
            <PlusMini />
            Assign Role
          </Button>
        </div>
      </div>

      {/* Users table */}
      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading users...</Text>
      ) : filteredUsers.length === 0 ? (
        <Text className="text-ui-fg-subtle p-4">
          {searchText.trim()
            ? "No users match your filter."
            : "No admin users found."}
        </Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Email</Table.HeaderCell>
              <Table.HeaderCell>User ID</Table.HeaderCell>
              <Table.HeaderCell>Assigned Roles</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filteredUsers.map((user) => (
              <Table.Row key={user.user_id}>
                <Table.Cell>
                  <Text className="text-sm font-medium">
                    {user.email ?? "--"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-xs font-mono text-ui-fg-subtle">
                    {user.user_id.slice(-12)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex flex-wrap gap-1.5">
                    {user.roles.length === 0 ? (
                      <Text className="text-sm text-ui-fg-muted">
                        No roles
                      </Text>
                    ) : (
                      user.roles.map((r) => {
                        const isRevoking = revoking === `${user.user_id}:${r.role_code}`
                        return (
                          <span
                            key={r.role_code}
                            className="inline-flex items-center gap-1"
                          >
                            <Badge color="blue">{getRoleName(r.role_code)}</Badge>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-ui-bg-subtle-hover text-ui-fg-muted hover:text-ui-fg-base transition-colors"
                              title={`Revoke ${getRoleName(r.role_code)}`}
                              disabled={isRevoking}
                              onClick={() => handleRevoke(user.user_id, r.role_code)}
                            >
                              <XMark className="w-3 h-3" />
                            </button>
                          </span>
                        )
                      })
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell className="text-right">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      setAssignUserId(user.user_id)
                      setAssignOpen(true)
                    }}
                  >
                    <PlusMini />
                    Add Role
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {/* Assign Role Drawer */}
      <Drawer open={assignOpen} onOpenChange={setAssignOpen}>
        <Drawer.Content className="!max-w-[500px]">
          <Drawer.Header>
            <Drawer.Title>Assign Role to User</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4 overflow-y-auto">
            <div className="flex flex-col gap-4">
              <div>
                <Label className="text-xs">User *</Label>
                <Select
                  value={assignUserId}
                  onValueChange={(v) => setAssignUserId(v)}
                >
                  <Select.Trigger className="mt-1">
                    <Select.Value placeholder="Select a user..." />
                  </Select.Trigger>
                  <Select.Content>
                    {users.map((u) => (
                      <Select.Item key={u.user_id} value={u.user_id}>
                        {u.email ?? u.user_id.slice(-12)} ({u.user_id.slice(-8)})
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Role *</Label>
                <Select
                  value={assignRoleCode}
                  onValueChange={(v) => setAssignRoleCode(v)}
                >
                  <Select.Trigger className="mt-1">
                    <Select.Value placeholder="Select a role..." />
                  </Select.Trigger>
                  <Select.Content>
                    {roles.map((role) => (
                      <Select.Item key={role.code} value={role.code}>
                        {role.name} ({role.code})
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Reason</Label>
                <Input
                  className="mt-1"
                  placeholder="Reason for assignment (optional)..."
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                />
              </div>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Drawer.Close>
            <Button
              variant="primary"
              disabled={assigning || !assignUserId || !assignRoleCode}
              onClick={handleAssign}
            >
              {assigning ? "Assigning..." : "Assign Role"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────────

const AuditLogTab = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState("all")

  const fetchAuditLog = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = { limit: "50" }
      if (actionFilter !== "all") query.action = actionFilter

      const json = await sdk.client.fetch<{ entries?: AuditEntry[]; audit_log?: AuditEntry[] }>(
        "/admin/rbac/audit-log",
        { query }
      )
      setEntries(json.entries ?? json.audit_log ?? [])
    } catch (err) {
      console.error("[rbac-audit-log]", err)
      toast.error("Failed to load audit log")
    } finally {
      setLoading(false)
    }
  }, [actionFilter])

  useEffect(() => {
    fetchAuditLog()
  }, [fetchAuditLog])

  const assignCount = entries.filter((e) => e.action === "assign").length
  const revokeCount = entries.filter((e) => e.action === "revoke").length

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Entries" value={entries.length} sub="Last 50 entries" />
        <StatCard label="Assignments" value={assignCount} />
        <StatCard label="Revocations" value={revokeCount} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Text className="text-xs text-ui-fg-subtle mb-1">Filter by action</Text>
          <Select
            value={actionFilter}
            onValueChange={(v) => setActionFilter(v)}
          >
            <Select.Trigger>
              <Select.Value placeholder="All actions" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All actions</Select.Item>
              <Select.Item value="assign">Assign</Select.Item>
              <Select.Item value="revoke">Revoke</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <Button variant="secondary" size="small" onClick={fetchAuditLog}>
          <ArrowPath />
          Refresh
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading audit log...</Text>
      ) : entries.length === 0 ? (
        <Text className="text-ui-fg-subtle p-4">No audit log entries found.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell>User</Table.HeaderCell>
              <Table.HeaderCell>Role</Table.HeaderCell>
              <Table.HeaderCell>Action</Table.HeaderCell>
              <Table.HeaderCell>Performed By</Table.HeaderCell>
              <Table.HeaderCell>Reason</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {entries.map((entry) => (
              <Table.Row key={entry.id}>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle whitespace-nowrap">
                    {fmtDateTime(entry.created_at)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <div>
                    <Text className="text-sm font-mono">
                      {entry.user_id.slice(-12)}
                    </Text>
                    {entry.user_email && (
                      <Text className="text-xs text-ui-fg-muted">
                        {entry.user_email}
                      </Text>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div>
                    <Text className="text-sm font-medium">{entry.role_name}</Text>
                    <Text className="text-xs font-mono text-ui-fg-muted">
                      {entry.role_code}
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={entry.action === "assign" ? "green" : "red"}>
                    {entry.action === "assign" ? "ASSIGN" : "REVOKE"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm font-mono">
                    {entry.performed_by?.slice(-12) ?? "--"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text
                    className="text-sm text-ui-fg-subtle truncate max-w-[200px]"
                    title={entry.reason}
                  >
                    {entry.reason || "--"}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  )
}

// ── Invite User Tab ──────────────────────────────────────────────────────────

type PendingInvite = {
  id: string
  email: string
  role_code: string
  invited_by: string
  created_at: string
}

const InviteUserTab = () => {
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [email, setEmail] = useState("")
  const [roleCode, setRoleCode] = useState("")
  const [sending, setSending] = useState(false)

  const fetchRoles = useCallback(async () => {
    try {
      const json = await sdk.client.fetch<{ roles: RoleDefinition[] }>("/admin/rbac/roles")
      setRoles(json.roles ?? [])
    } catch {
      // Non-critical
    }
  }, [])

  const fetchPendingInvites = useCallback(async () => {
    setLoading(true)
    try {
      const json = await sdk.client.fetch<{ invite_roles: PendingInvite[] }>("/admin/rbac/invite")
      setPendingInvites(json.invite_roles ?? [])
    } catch (err) {
      console.error("[rbac-invite]", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
    fetchPendingInvites()
  }, [fetchRoles, fetchPendingInvites])

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Email is required")
      return
    }
    if (!roleCode) {
      toast.error("Please select a role")
      return
    }

    setSending(true)
    try {
      const json = await sdk.client.fetch<{ message?: string }>("/admin/rbac/invite", {
        method: "POST",
        body: { email: email.trim(), role_code: roleCode },
      })

      toast.success(json.message || "Invite sent!")
      setEmail("")
      setRoleCode("")
      fetchPendingInvites()
    } catch (err: any) {
      toast.error("Failed to send invite", { description: err.message })
    } finally {
      setSending(false)
    }
  }

  const getRoleName = (code: string): string => {
    const role = roles.find((r) => r.code === code)
    return role?.name ?? code
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Invite form */}
      <div className="p-5 rounded-lg border border-ui-border-base bg-ui-bg-base">
        <Text className="text-sm font-medium mb-4">
          Send Invite with Pre-assigned Role
        </Text>
        <Text className="text-xs text-ui-fg-muted mb-4">
          The invited user will automatically receive the selected role when they
          accept the invitation. If no role is selected, they default to "Viewer".
        </Text>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <Label className="text-xs">Email Address *</Label>
            <Input
              className="mt-1"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleInvite()
              }}
            />
          </div>
          <div className="w-[240px]">
            <Label className="text-xs">Role *</Label>
            <Select value={roleCode} onValueChange={(v) => setRoleCode(v)}>
              <Select.Trigger className="mt-1">
                <Select.Value placeholder="Select a role..." />
              </Select.Trigger>
              <Select.Content>
                {roles.map((role) => (
                  <Select.Item key={role.code} value={role.code}>
                    {role.name} ({role.code})
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <Button
            variant="primary"
            size="small"
            disabled={sending || !email.trim() || !roleCode}
            onClick={handleInvite}
          >
            <EnvelopeSolid />
            {sending ? "Sending..." : "Send Invite"}
          </Button>
        </div>
      </div>

      {/* Pending invites table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Text className="text-sm font-medium">
            Pending Invite Role Mappings
          </Text>
          <Button variant="secondary" size="small" onClick={fetchPendingInvites}>
            <ArrowPath />
            Refresh
          </Button>
        </div>

        {loading ? (
          <Text className="text-ui-fg-subtle p-4">Loading...</Text>
        ) : pendingInvites.length === 0 ? (
          <div className="text-center py-8">
            <Text className="text-ui-fg-subtle">
              No pending invite-role mappings. Roles are assigned automatically
              when users accept their invites.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Email</Table.HeaderCell>
                <Table.HeaderCell>Intended Role</Table.HeaderCell>
                <Table.HeaderCell>Invited By</Table.HeaderCell>
                <Table.HeaderCell>Created</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {pendingInvites.map((inv) => (
                <Table.Row key={inv.id}>
                  <Table.Cell>
                    <Text className="text-sm">{inv.email}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="blue">{getRoleName(inv.role_code)}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm font-mono text-ui-fg-subtle">
                      {inv.invited_by?.slice(-12) ?? "system"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm text-ui-fg-subtle">
                      {fmtDateTime(inv.created_at)}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </div>
  )
}

// ── Staff Credentials Tab ─────────────────────────────────────────────────────

type StaffCredentialEntry = {
  id: string
  user_id: string
  user_email: string | null
  credential_type: string
  credential_value: string
  holder_name: string
  issuing_authority: string | null
  valid_from: string | null
  valid_until: string | null
  is_verified: boolean
  verified_by: string | null
  verified_at: string | null
}

const CREDENTIAL_TYPES = [
  { value: "pharmacist_registration", label: "Pharmacist Registration (State Pharmacy Council)" },
  { value: "mci_registration", label: "MCI Registration (Medical Council)" },
  { value: "drug_license", label: "Drug License (State Drug Authority)" },
  { value: "other", label: "Other" },
]

const credentialTypeLabel = (type: string): string =>
  CREDENTIAL_TYPES.find((t) => t.value === type)?.label ?? type

const StaffCredentialsTab = () => {
  const [credentials, setCredentials] = useState<StaffCredentialEntry[]>([])
  const [users, setUsers] = useState<{ user_id: string; email: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  // Add form state
  const [addOpen, setAddOpen] = useState(false)
  const [addUserId, setAddUserId] = useState("")
  const [addType, setAddType] = useState("")
  const [addValue, setAddValue] = useState("")
  const [addHolderName, setAddHolderName] = useState("")
  const [addAuthority, setAddAuthority] = useState("")
  const [addValidFrom, setAddValidFrom] = useState("")
  const [addValidUntil, setAddValidUntil] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchCredentials = useCallback(async () => {
    setLoading(true)
    try {
      const json = await sdk.client.fetch<{ credentials: StaffCredentialEntry[] }>(
        "/admin/rbac/credentials"
      )
      setCredentials(json.credentials ?? [])
    } catch (err) {
      console.error("[rbac-credentials]", err)
      toast.error("Failed to load credentials")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const json = await sdk.client.fetch<{
        users: { user_id: string; email: string | null }[]
      }>("/admin/rbac/users", { query: { limit: "100" } })
      setUsers(json.users ?? [])
    } catch {
      // Non-critical
    }
  }, [])

  useEffect(() => {
    fetchCredentials()
    fetchUsers()
  }, [fetchCredentials, fetchUsers])

  const handleAdd = async () => {
    if (!addUserId || !addType || !addValue || !addHolderName) {
      toast.error("User, type, value, and holder name are required")
      return
    }
    setSubmitting(true)
    try {
      await sdk.client.fetch("/admin/rbac/credentials", {
        method: "POST",
        body: {
          user_id: addUserId,
          credential_type: addType,
          credential_value: addValue,
          holder_name: addHolderName,
          issuing_authority: addAuthority || undefined,
          valid_from: addValidFrom || undefined,
          valid_until: addValidUntil || undefined,
        },
      })
      toast.success("Credential added")
      setAddOpen(false)
      setAddUserId("")
      setAddType("")
      setAddValue("")
      setAddHolderName("")
      setAddAuthority("")
      setAddValidFrom("")
      setAddValidUntil("")
      fetchCredentials()
    } catch (err: any) {
      toast.error("Failed to add credential", { description: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async (id: string, isVerified: boolean) => {
    try {
      await sdk.client.fetch(`/admin/rbac/credentials/${id}`, {
        method: "POST",
        body: { is_verified: !isVerified },
      })
      toast.success(isVerified ? "Verification removed" : "Credential verified")
      fetchCredentials()
    } catch (err: any) {
      toast.error("Failed to update", { description: err.message })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await sdk.client.fetch(`/admin/rbac/credentials/${id}`, {
        method: "DELETE",
      })
      toast.success("Credential deleted")
      fetchCredentials()
    } catch (err: any) {
      toast.error("Failed to delete", { description: err.message })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Text className="text-sm font-medium">Staff Professional Credentials</Text>
          <Text className="text-xs text-ui-fg-muted mt-0.5">
            Store pharmacist registration numbers, drug licenses, and other
            professional credentials. These auto-populate in prescription
            approvals, H1 register, and supply memos.
          </Text>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="small" onClick={fetchCredentials}>
            <ArrowPath />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={() => setAddOpen(true)}
          >
            <PlusMini />
            Add Credential
          </Button>
        </div>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading credentials...</Text>
      ) : credentials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Text className="text-ui-fg-subtle mb-1">
            No staff credentials registered yet.
          </Text>
          <Text className="text-xs text-ui-fg-muted">
            Add pharmacist registration numbers to enable compliant Rx approvals.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>User</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Registration No.</Table.HeaderCell>
              <Table.HeaderCell>Holder Name</Table.HeaderCell>
              <Table.HeaderCell>Authority</Table.HeaderCell>
              <Table.HeaderCell>Valid Until</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {credentials.map((cred) => (
              <Table.Row key={cred.id}>
                <Table.Cell>
                  <Text className="text-sm">{cred.user_email ?? cred.user_id.slice(-12)}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color="blue" className="text-[10px]">
                    {cred.credential_type.replace(/_/g, " ")}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm font-mono font-medium">
                    {cred.credential_value}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm">{cred.holder_name}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle">
                    {cred.issuing_authority ?? "--"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle">
                    {cred.valid_until
                      ? new Date(cred.valid_until).toLocaleDateString("en-IN")
                      : "--"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  {cred.is_verified ? (
                    <Badge color="green">Verified</Badge>
                  ) : (
                    <Badge color="orange">Unverified</Badge>
                  )}
                </Table.Cell>
                <Table.Cell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleVerify(cred.id, cred.is_verified)}
                    >
                      {cred.is_verified ? "Unverify" : "Verify"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleDelete(cred.id)}
                    >
                      <XMark className="w-3 h-3" />
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {/* Add Credential Drawer */}
      <Drawer open={addOpen} onOpenChange={setAddOpen}>
        <Drawer.Content className="!max-w-[540px]">
          <Drawer.Header>
            <Drawer.Title>Add Staff Credential</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4 overflow-y-auto">
            <div className="flex flex-col gap-4">
              <div>
                <Label className="text-xs">User *</Label>
                <Select value={addUserId} onValueChange={(v) => setAddUserId(v)}>
                  <Select.Trigger className="mt-1">
                    <Select.Value placeholder="Select a user..." />
                  </Select.Trigger>
                  <Select.Content>
                    {users.map((u) => (
                      <Select.Item key={u.user_id} value={u.user_id}>
                        {u.email ?? u.user_id.slice(-12)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Credential Type *</Label>
                <Select value={addType} onValueChange={(v) => setAddType(v)}>
                  <Select.Trigger className="mt-1">
                    <Select.Value placeholder="Select type..." />
                  </Select.Trigger>
                  <Select.Content>
                    {CREDENTIAL_TYPES.map((ct) => (
                      <Select.Item key={ct.value} value={ct.value}>
                        {ct.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Registration / License Number *</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. PH/12345/2024"
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Holder Name (as on certificate) *</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Dr. Ramesh Kumar"
                  value={addHolderName}
                  onChange={(e) => setAddHolderName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Issuing Authority</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Karnataka State Pharmacy Council"
                  value={addAuthority}
                  onChange={(e) => setAddAuthority(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valid From</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={addValidFrom}
                    onChange={(e) => setAddValidFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Valid Until</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={addValidUntil}
                    onChange={(e) => setAddValidUntil(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Drawer.Close>
            <Button
              variant="primary"
              disabled={submitting || !addUserId || !addType || !addValue || !addHolderName}
              onClick={handleAdd}
            >
              {submitting ? "Saving..." : "Add Credential"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ── Pending Signups Tab ──────────────────────────────────────────────────────

type SignupRequest = {
  id: string
  email: string
  first_name: string
  last_name: string
  requested_role_code: string
  status: "pending" | "approved" | "rejected"
  user_id: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
}

const PendingSignupsTab = () => {
  const [requests, setRequests] = useState<SignupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = { limit: "50" }
      if (statusFilter !== "all") query.status = statusFilter

      const json = await sdk.client.fetch<{
        signup_requests: SignupRequest[]
        count: number
      }>("/admin/rbac/signup-requests", { query })
      setRequests(json.signup_requests ?? [])
    } catch (err) {
      console.error("[rbac-signup-requests]", err)
      toast.error("Failed to load signup requests")
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleApprove = async (id: string) => {
    setProcessingId(id)
    try {
      const json = await sdk.client.fetch<{ success: boolean; message: string }>(
        `/admin/rbac/signup-requests/${id}/review`,
        {
          method: "POST",
          body: { action: "approve" },
        }
      )
      toast.success(json.message || "Request approved")
      fetchRequests()
    } catch (err: any) {
      toast.error("Failed to approve", { description: err.message })
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (id: string) => {
    setProcessingId(id)
    try {
      const json = await sdk.client.fetch<{ success: boolean; message: string }>(
        `/admin/rbac/signup-requests/${id}/review`,
        {
          method: "POST",
          body: {
            action: "reject",
            rejection_reason: rejectReason.trim() || undefined,
          },
        }
      )
      toast.success(json.message || "Request rejected")
      setRejectId(null)
      setRejectReason("")
      fetchRequests()
    } catch (err: any) {
      toast.error("Failed to reject", { description: err.message })
    } finally {
      setProcessingId(null)
    }
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Pending Requests"
          value={statusFilter === "pending" ? requests.length : pendingCount}
          sub="Awaiting admin review"
        />
        <StatCard
          label="Showing"
          value={requests.length}
          sub={statusFilter === "all" ? "All statuses" : `${statusFilter} only`}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Text className="text-xs text-ui-fg-subtle mb-1">Filter by status</Text>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
            <Select.Trigger>
              <Select.Value placeholder="All statuses" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All statuses</Select.Item>
              <Select.Item value="pending">Pending</Select.Item>
              <Select.Item value="approved">Approved</Select.Item>
              <Select.Item value="rejected">Rejected</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <Button variant="secondary" size="small" onClick={fetchRequests}>
          <ArrowPath />
          Refresh
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading signup requests...</Text>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Text className="text-ui-fg-subtle mb-1">
            No signup requests found.
          </Text>
          <Text className="text-xs text-ui-fg-muted">
            {statusFilter === "pending"
              ? "There are no pending role escalation requests."
              : "No requests match the selected filter."}
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Email</Table.HeaderCell>
              <Table.HeaderCell>Requested Role</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Submitted</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {requests.map((req) => (
              <Table.Row key={req.id}>
                <Table.Cell>
                  <Text className="text-sm font-medium">
                    {req.first_name} {req.last_name}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm">{req.email}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color="blue">{req.requested_role_code}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    color={
                      req.status === "pending"
                        ? "orange"
                        : req.status === "approved"
                        ? "green"
                        : "red"
                    }
                  >
                    {req.status.toUpperCase()}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle whitespace-nowrap">
                    {fmtDateTime(req.created_at)}
                  </Text>
                </Table.Cell>
                <Table.Cell className="text-right">
                  {req.status === "pending" ? (
                    <div className="flex justify-end gap-1">
                      {rejectId === req.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Reason (optional)"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-48 text-xs"
                          />
                          <Button
                            variant="danger"
                            size="small"
                            disabled={processingId === req.id}
                            onClick={() => handleReject(req.id)}
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => {
                              setRejectId(null)
                              setRejectReason("")
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            variant="primary"
                            size="small"
                            disabled={processingId === req.id}
                            onClick={() => handleApprove(req.id)}
                          >
                            <CheckCircleSolid className="w-3.5 h-3.5" />
                            Approve
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            disabled={processingId === req.id}
                            onClick={() => setRejectId(req.id)}
                          >
                            <XCircleSolid className="w-3.5 h-3.5" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <Text className="text-xs text-ui-fg-muted">
                      {req.reviewed_at ? `Reviewed ${fmtDateTime(req.reviewed_at)}` : "--"}
                      {req.rejection_reason && (
                        <span className="block mt-0.5">
                          Reason: {req.rejection_reason}
                        </span>
                      )}
                    </Text>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  )
}

const RolesPage = () => {
  return (
    <div className="flex flex-col gap-4">
      <Container className="p-6">
        <Heading level="h1" className="mb-2">
          Roles and Access Control
        </Heading>
        <Text className="text-ui-fg-subtle">
          Manage RBAC role definitions, assign or revoke roles for admin users,
          and review the audit trail of all role changes.
        </Text>
      </Container>

      {/* Current user's role card */}
      <MyRoleCard />

      <Container className="p-6">
        <Tabs defaultValue="roles-overview">
          <Tabs.List>
            <Tabs.Trigger value="roles-overview">Roles Overview</Tabs.Trigger>
            <Tabs.Trigger value="pending-signups">Pending Signups</Tabs.Trigger>
            <Tabs.Trigger value="invite-user">Invite User</Tabs.Trigger>
            <Tabs.Trigger value="user-roles">User Roles</Tabs.Trigger>
            <Tabs.Trigger value="credentials">Staff Credentials</Tabs.Trigger>
            <Tabs.Trigger value="audit-log">Audit Log</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="roles-overview" className="pt-4">
            <RolesOverviewTab />
          </Tabs.Content>

          <Tabs.Content value="pending-signups" className="pt-4">
            <PendingSignupsTab />
          </Tabs.Content>

          <Tabs.Content value="invite-user" className="pt-4">
            <InviteUserTab />
          </Tabs.Content>

          <Tabs.Content value="user-roles" className="pt-4">
            <UserRolesTab />
          </Tabs.Content>

          <Tabs.Content value="credentials" className="pt-4">
            <StaffCredentialsTab />
          </Tabs.Content>

          <Tabs.Content value="audit-log" className="pt-4">
            <AuditLogTab />
          </Tabs.Content>
        </Tabs>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Roles & Access",
  icon: LockClosedSolid,
})

export default RolesPage
