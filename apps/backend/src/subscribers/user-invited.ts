import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

const LOG_PREFIX = "[subscriber:user-invited]"

export default async function inviteCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const inviteId = data.id
  console.info(`${LOG_PREFIX} Processing invite ${inviteId}`)

  try {
    const query = container.resolve("query")
    const notificationService = container.resolve(Modules.NOTIFICATION) as any

    const { data: invites } = await query.graph({
      entity: "invite",
      fields: ["email", "token"],
      filters: { id: inviteId },
    })

    const invite = invites?.[0]
    if (!invite?.email || !invite?.token) {
      console.warn(`${LOG_PREFIX} Invite ${inviteId} missing email or token — skipping`)
      return
    }

    // Build the accept-invite URL pointing to the admin dashboard
    const backendUrl = process.env.BACKEND_URL || process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
    const adminPath = process.env.MEDUSA_ADMIN_PATH || "/app"
    const inviteUrl = `${backendUrl}${adminPath}/invite?token=${invite.token}`

    await notificationService.createNotifications({
      to: invite.email,
      channel: "email",
      template: "user-invited",
      data: {
        invite_url: inviteUrl,
        email: invite.email,
      },
    })

    console.info(`${LOG_PREFIX} Invite email sent to ${invite.email}`)
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Failed to send invite email for ${inviteId}:`,
      (error as Error).message
    )
  }
}

export const config: SubscriberConfig = {
  event: ["invite.created", "invite.resent"],
}
