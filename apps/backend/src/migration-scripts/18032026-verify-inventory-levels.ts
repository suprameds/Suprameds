import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function verify_inventory_levels({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: variants } = await query.graph({
    entity: "variant",
    fields: [
      "id",
      "sku",
      "manage_inventory",
      "inventory_items.inventory_item_id",
      "inventory_items.inventory.location_levels.stocked_quantity",
      "inventory_items.inventory.location_levels.location_id",
      "inventory_items.inventory.location_levels.stock_locations.name",
    ],
    filters: {
      sku: [
        "SUPRA-GLIMCYN-M-TAB",
        "SUPRA-PARACETAMOL-500MG-TABLET",
        "SUPRA-DIGITAL-THERMOMETER",
      ],
    },
  })

  logger.info(`[verify] variants_sample=${JSON.stringify(variants)}`)
}

