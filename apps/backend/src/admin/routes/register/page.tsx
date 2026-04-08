import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import { PlusMini } from "@medusajs/icons"
import { useCallback, useState } from "react"

// ── Role tiers matching the RBAC seed ────────────────────────────────────────

type RoleOption = {
  code: string
  label: string
  gated: boolean
}

type RoleTier = {
  name: string
  roles: RoleOption[]
}

const UNGATED_ROLES = new Set([
  "viewer",
  "guest",
  "customer",
  "support_agent",
  "catalog_manager",
  "content_moderator",
])

const ROLE_TIERS: RoleTier[] = [
  {
    name: "Tier 1 — Customer",
    roles: [
      { code: "guest", label: "Guest", gated: false },
      { code: "customer", label: "Customer", gated: false },
      { code: "b2b_buyer", label: "B2B Buyer", gated: true },
      { code: "b2b_admin", label: "B2B Admin", gated: true },
    ],
  },
  {
    name: "Tier 2 — Clinical",
    roles: [
      { code: "pharmacy_technician", label: "Pharmacy Technician", gated: true },
      { code: "pharmacist", label: "Pharmacist", gated: true },
      { code: "pharmacist_in_charge", label: "Pharmacist-in-Charge", gated: true },
    ],
  },
  {
    name: "Tier 3 — Warehouse",
    roles: [
      { code: "grn_staff", label: "GRN Staff", gated: true },
      { code: "qc_staff", label: "QC Staff", gated: true },
      { code: "picker", label: "Picker", gated: true },
      { code: "packer", label: "Packer", gated: true },
      { code: "dispatch_staff", label: "Dispatch Staff", gated: true },
      { code: "returns_staff", label: "Returns Staff", gated: true },
      { code: "warehouse_manager", label: "Warehouse Manager", gated: true },
    ],
  },
  {
    name: "Tier 4 — Business",
    roles: [
      { code: "support_agent", label: "Support Agent", gated: false },
      { code: "support_supervisor", label: "Support Supervisor", gated: true },
      { code: "catalog_manager", label: "Catalog Manager", gated: false },
      { code: "content_moderator", label: "Content Moderator", gated: false },
      { code: "marketing_admin", label: "Marketing Admin", gated: true },
      { code: "finance_admin", label: "Finance Admin", gated: true },
      { code: "compliance_officer", label: "Compliance Officer", gated: true },
      { code: "platform_admin", label: "Platform Admin", gated: true },
    ],
  },
  {
    name: "Tier 5 — Elevated",
    roles: [
      { code: "super_admin", label: "Super Admin", gated: true },
      { code: "viewer", label: "Viewer", gated: false },
    ],
  },
]

const ALL_ROLES = ROLE_TIERS.flatMap((t) => t.roles)

// ── Page Component ───────────────────────────────────────────────────────────

const RegisterPage = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [roleCode, setRoleCode] = useState("viewer")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    pending_role?: string | null
  } | null>(null)

  const selectedRole = ALL_ROLES.find((r) => r.code === roleCode)
  const isGated = selectedRole?.gated ?? false

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitting(true)
      setResult(null)

      try {
        const resp = await fetch("/admin/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            requested_role_code: roleCode,
          }),
        })

        const data = await resp.json()

        if (!resp.ok) {
          toast.error("Registration failed", {
            description: data.message || "Please check your input and try again.",
          })
          return
        }

        setResult({
          success: true,
          message: data.message,
          pending_role: data.pending_role,
        })
        toast.success("Account created!")

        // Reset form
        setEmail("")
        setPassword("")
        setFirstName("")
        setLastName("")
        setRoleCode("viewer")
      } catch (err: any) {
        toast.error("Network error", {
          description: "Could not connect to the server. Please try again.",
        })
      } finally {
        setSubmitting(false)
      }
    },
    [email, password, firstName, lastName, roleCode]
  )

  return (
    <Container className="max-w-lg mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <Heading level="h1" className="text-xl font-semibold">
            Create Admin Account
          </Heading>
          <Text className="text-ui-fg-subtle mt-1">
            Register for platform access. Some roles require admin approval.
          </Text>
        </div>

        {result?.success && (
          <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
            <Text className="font-medium text-ui-fg-base">
              {result.message}
            </Text>
            {result.pending_role && (
              <Text className="text-sm text-ui-fg-subtle mt-2">
                You can sign in now with viewer access. An administrator will review
                your request for the{" "}
                <span className="font-medium">{result.pending_role}</span> role.
              </Text>
            )}
            <Button
              variant="secondary"
              size="small"
              className="mt-3"
              onClick={() => {
                window.location.href = "/app/login"
              }}
            >
              Go to Login
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="first_name" className="text-sm font-medium">
                First Name
              </Label>
              <Input
                id="first_name"
                type="text"
                placeholder="Enter first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="last_name" className="text-sm font-medium">
                Last Name
              </Label>
              <Input
                id="last_name"
                type="text"
                placeholder="Enter last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 8 chars, 1 upper, 1 lower, 1 digit"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <Text className="text-xs text-ui-fg-muted mt-1">
              Must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 digit.
            </Text>
          </div>

          {/* Role selection */}
          <div>
            <Label htmlFor="role" className="text-sm font-medium">
              Requested Role
            </Label>
            <Select value={roleCode} onValueChange={setRoleCode}>
              <Select.Trigger>
                <Select.Value placeholder="Select a role" />
              </Select.Trigger>
              <Select.Content>
                {ROLE_TIERS.map((tier) => (
                  <Select.Group key={tier.name}>
                    <Select.Label>{tier.name}</Select.Label>
                    {tier.roles.map((role) => (
                      <Select.Item key={role.code} value={role.code}>
                        <span className="flex items-center gap-2">
                          {role.label}
                          {role.gated && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-ui-tag-orange-bg text-ui-tag-orange-text font-medium">
                              Approval required
                            </span>
                          )}
                        </span>
                      </Select.Item>
                    ))}
                  </Select.Group>
                ))}
              </Select.Content>
            </Select>

            {isGated && (
              <div className="mt-2 p-3 rounded border border-ui-tag-orange-border bg-ui-tag-orange-bg/30">
                <Text className="text-xs text-ui-fg-subtle">
                  <strong>Note:</strong> The{" "}
                  <span className="font-medium">{selectedRole?.label}</span> role
                  requires admin approval. You will be granted viewer access
                  immediately and can start using the platform. An administrator
                  will review your role request.
                </Text>
              </div>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            isLoading={submitting}
            disabled={submitting}
            className="w-full mt-2"
          >
            Create Account
          </Button>
        </form>

        <div className="text-center">
          <Text className="text-sm text-ui-fg-muted">
            Already have an account?{" "}
            <a
              href="/app/login"
              className="text-ui-fg-interactive hover:underline"
            >
              Sign in
            </a>
          </Text>
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Register",
  icon: PlusMini,
})

export default RegisterPage
