import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../lib/client"

const ROLES = [
  { value: "customer", label: "Customer", color: "grey" as const },
  { value: "pharmacist", label: "Pharmacist", color: "green" as const },
]

const CustomerRoleWidget = ({ data: customer }: { data: { id: string } }) => {
  const [currentRole, setCurrentRole] = useState("customer")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    if (!customer?.id) return
    sdk.client
      .fetch<{ role: string }>(`/admin/customers/${customer.id}/role`)
      .then((data) => setCurrentRole(data.role || "customer"))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customer?.id])

  const handleSetRole = async (role: string) => {
    setSaving(true)
    setMessage(null)
    try {
      await sdk.client.fetch(`/admin/customers/${customer.id}/role`, {
        method: "POST",
        body: { role },
      })
      setCurrentRole(role)
      setMessage({ type: "success", text: `Role set to ${role}.` })
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update role." })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">Role</Heading>
        </div>
        <div className="px-6 py-4">
          <Text className="text-ui-fg-subtle text-sm">Loading...</Text>
        </div>
      </Container>
    )
  }

  const roleInfo = ROLES.find((r) => r.value === currentRole) || ROLES[0]

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Role</Heading>
        <Badge color={roleInfo.color}>{roleInfo.label}</Badge>
      </div>
      <div className="px-6 py-4">
        <div className="flex items-center gap-2">
          {ROLES.map((role) => (
            <Button
              key={role.value}
              variant={currentRole === role.value ? "primary" : "secondary"}
              size="small"
              disabled={saving || currentRole === role.value}
              onClick={() => handleSetRole(role.value)}
            >
              {role.label}
            </Button>
          ))}
        </div>
        {message && (
          <Text
            className="text-xs mt-2"
            style={{ color: message.type === "success" ? "#065F46" : "#991B1B" }}
          >
            {message.text}
          </Text>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "customer.details.after",
})

export default CustomerRoleWidget
