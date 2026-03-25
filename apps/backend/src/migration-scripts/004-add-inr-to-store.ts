/**
 * Ensures INR is the ONLY and DEFAULT currency on the store.
 *
 * Suprameds operates exclusively in India — no USD/EUR needed.
 * If the initial seed already set INR as default, this is a no-op.
 * If an older seed left USD/EUR, this replaces them with INR only.
 */

import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"

export default async function add_inr_to_store({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const storeModule = container.resolve(ModuleRegistrationName.STORE) as any

  const [store] = await storeModule.listStores()
  if (!store) {
    logger.warn("[add-inr] No store found; skipping.")
    return
  }

  const supported = (store.supported_currencies ?? []) as {
    currency_code: string
    is_default?: boolean
  }[]

  // Check if INR is already the sole default currency
  const hasInrDefault = supported.some(
    (c) => c.currency_code?.toLowerCase() === "inr" && c.is_default
  )
  const onlyInr = supported.length === 1 && hasInrDefault

  if (onlyInr) {
    logger.info("[add-inr] Store already configured with INR only; skipping.")
    return
  }

  // Replace all currencies with INR as the sole default
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          { currency_code: "inr", is_default: true },
        ],
      },
    },
  })

  const removed = supported
    .filter((c) => c.currency_code?.toLowerCase() !== "inr")
    .map((c) => c.currency_code)

  if (removed.length) {
    logger.info(`[add-inr] Removed non-INR currencies: ${removed.join(", ")}`)
  }
  logger.info("[add-inr] Store set to INR as sole default currency.")
}
