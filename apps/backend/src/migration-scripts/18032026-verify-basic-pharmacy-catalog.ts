import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function verify_basic_pharmacy_catalog({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "parent_category_id"],
  })

  const { data: collections } = await query.graph({
    entity: "product_collection",
    fields: ["id", "title", "handle"],
  })

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "status",
      "collection_id",
      "sales_channels.*",
      "metadata",
    ],
  })

  const seeded = (products as any[]).filter(
    (p) => p?.metadata?.source === "seed-basic-pharmacy-2026"
  )
  const missingSalesChannel = seeded.filter((p) => !p.sales_channels?.length)
  const missingCollection = seeded.filter((p) => !p.collection_id)
  const notPublished = seeded.filter((p) => p.status !== "published")

  logger.info(`[verify] categories=${(categories as any[]).length}`)
  logger.info(`[verify] collections=${(collections as any[]).length}`)
  logger.info(`[verify] products_total=${(products as any[]).length}`)
  logger.info(`[verify] products_seeded=${seeded.length}`)
  logger.info(`[verify] seeded_missing_sales_channel=${missingSalesChannel.length}`)
  logger.info(`[verify] seeded_missing_collection=${missingCollection.length}`)
  logger.info(`[verify] seeded_not_published=${notPublished.length}`)

  const sample = seeded.slice(0, 5).map((p) => ({
    title: p.title,
    handle: p.handle,
    status: p.status,
    sales_channels: (p.sales_channels ?? []).map((sc: any) => sc.name ?? sc.id),
    collection_id: p.collection_id,
  }))
  logger.info(`[verify] sample=${JSON.stringify(sample)}`)
}

