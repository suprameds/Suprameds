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
import { ArrowPath, EnvelopeSolid, LockClosedSolid, MagnifyingGlass, PlusMini, User, XMark } from "@medusajs/icons"
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

// ── Main Page ─────────────────────────────────────────────────────────────────

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
            <Tabs.Trigger value="invite-user">Invite User</Tabs.Trigger>
            <Tabs.Trigger value="user-roles">User Roles</Tabs.Trigger>
            <Tabs.Trigger value="audit-log">Audit Log</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="roles-overview" className="pt-4">
            <RolesOverviewTab />
          </Tabs.Content>

          <Tabs.Content value="invite-user" className="pt-4">
            <InviteUserTab />
          </Tabs.Content>

          <Tabs.Content value="user-roles" className="pt-4">
            <UserRolesTab />
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
