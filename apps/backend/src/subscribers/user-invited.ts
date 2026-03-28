import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { captureException } from "../lib/sentry"

const LOG = "[subscriber:user-invited]"

export default async function inviteCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const inviteId = data.id
  console.info(`${LOG} Event fired for invite ${inviteId}`)

  try {
    const query = container.resolve("query")
    const notificationModuleService = container.resolve("notification") as any

    // Fetch invite — include all useful fields
    const { data: invites } = await query.graph({
      entity: "invite",
      fields: ["id", "email", "token", "accepted"],
      filters: { id: inviteId },
    })

    const invite = (invites as any[])?.[0]

    console.info(
      `${LOG} Invite data: email=${invite?.email}, token=${invite?.token ? "present" : "MISSING"}, accepted=${invite?.accepted}`
    )

    if (!invite?.email) {
      console.warn(`${LOG} Invite ${inviteId} has no email — cannot send`)
      return
    }

    // Build the accept-invite URL via configModule (official pattern)
    let backendUrl: string
    let adminPath: string
    try {
      const config = container.resolve("configModule") as any
      backendUrl =
        config?.admin?.backendUrl && config.admin.backendUrl !== "/"
          ? config.admin.backendUrl
          : process.env.BACKEND_URL ||
            process.env.MEDUSA_BACKEND_URL ||
            "http://localhost:9000"
      adminPath = config?.admin?.path || "/app"
    } catch {
      backendUrl =
        process.env.BACKEND_URL ||
        process.env.MEDUSA_BACKEND_URL ||
        "http://localhost:9000"
      adminPath = process.env.MEDUSA_ADMIN_PATH || "/app"
    }

    // If token is present, build a direct accept link; otherwise just point to admin
    const inviteUrl = invite.token
      ? `${backendUrl}${adminPath}/invite?token=${invite.token}`
      : `${backendUrl}${adminPath}`

    console.info(`${LOG} Sending invite email to ${invite.email}, url=${inviteUrl}`)

    await notificationModuleService.createNotifications({
      to: invite.email,
      channel: "email",
      template: "user-invited",
      data: {
        invite_url: inviteUrl,
        email: invite.email,
      },
    })

    console.info(`${LOG} Invite email queued for ${invite.email}`)
  } catch (error) {
    // Log the full error — don't swallow it
    console.error(`${LOG} FAILED for invite ${inviteId}:`, error)
    captureException(error, { subscriber: "user-invited", inviteId })
  }
}

export const config: SubscriberConfig = {
  event: ["invite.created", "invite.resent"],
}
