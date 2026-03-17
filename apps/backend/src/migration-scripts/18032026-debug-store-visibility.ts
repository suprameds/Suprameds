import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function debug_store_visibility({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.*"],
  })

  const { data: apiKeys } = await query.graph({
    entity: "api_keys",
    fields: ["id", "title", "token", "type", "revoked_at", "sales_channels.*"],
  })

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })

  // Link entity between publishable key and sales channel
  const { data: keySalesChannels } = await query.graph({
    entity: "publishable_api_key_sales_channels",
    fields: ["publishable_key_id", "sales_channel_id"],
  })

  logger.info(`[debug] regions=${JSON.stringify(regions)}`)
  logger.info(`[debug] sales_channels=${JSON.stringify(salesChannels)}`)
  logger.info(
    `[debug] api_keys=${JSON.stringify(
      (apiKeys as any[]).map((k) => ({
        id: k.id,
        title: k.title,
        token: k.token,
        type: k.type,
        revoked_at: k.revoked_at,
        sales_channels: (k.sales_channels ?? []).map((sc: any) => sc.name ?? sc.id),
      }))
    )}`
  )
  logger.info(`[debug] key_sales_channels=${JSON.stringify(keySalesChannels)}`)
}

