/**
 * Adds pp_system_default (COD) back to all regions alongside Razorpay.
 *
 * The earlier migration (19032026) replaced pp_system_default with Razorpay
 * only. This migration adds both providers so customers can choose between
 * Razorpay (online) and Cash on Delivery.
 */

import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

const RAZORPAY_PROVIDER_ID = "pp_razorpay_razorpay"
const SYSTEM_DEFAULT_ID = "pp_system_default"

export default async function addCodToRegion({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name"],
  })

  if (!regions?.length) {
    logger.info("[add-cod] No regions found; skipping.")
    return
  }

  for (const region of regions as { id: string; name: string }[]) {
    try {
      await updateRegionsWorkflow(container).run({
        input: {
          selector: { id: region.id },
          update: {
            payment_providers: [RAZORPAY_PROVIDER_ID, SYSTEM_DEFAULT_ID],
          },
        },
      })
      logger.info(
        `[add-cod] Added Razorpay + COD (system_default) to region: ${region.name} (${region.id})`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[add-cod] Failed for region ${region.name}: ${msg}`)
    }
  }
}
