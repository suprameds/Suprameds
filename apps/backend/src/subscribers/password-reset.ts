import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { captureException } from "../lib/sentry"

const LOG = "[subscriber:password-reset]"

/**
 * Handles auth.password_reset for both admin users and customers.
 * Sends a branded email with a reset link via the notification module.
 */
export default async function resetPasswordHandler({
  event: { data },
  container,
}: SubscriberArgs<{ entity_id: string; token: string; actor_type: string }>) {
  const email = data.entity_id
  const token = data.token
  const actorType = data.actor_type

  console.info(`${LOG} Reset requested for ${email} (actor: ${actorType})`)

  if (!email || !token) {
    console.warn(`${LOG} Missing email or token — skipping`)
    return
  }

  try {
    const notificationModuleService = container.resolve("notification") as any

    let resetUrl: string

    if (actorType === "customer") {
      const storefrontUrl =
        process.env.STOREFRONT_URL ||
        process.env.MEDUSA_STOREFRONT_URL ||
        "http://localhost:5173"
      resetUrl = `${storefrontUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`
    } else {
      // Admin user — build URL to the Medusa admin reset-password page
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
      resetUrl = `${backendUrl}${adminPath}/reset-password?token=${token}&email=${encodeURIComponent(email)}`
    }

    await notificationModuleService.createNotifications({
      to: email,
      channel: "email",
      template: "password-reset",
      data: {
        reset_url: resetUrl,
        email,
        actor_type: actorType,
      },
    })

    console.info(`${LOG} Reset email queued for ${email}`)
  } catch (err) {
    console.error(`${LOG} Failed for ${email}:`, err instanceof Error ? err.message : err)
    captureException(err, { subscriber: "password-reset", email, actorType })
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
