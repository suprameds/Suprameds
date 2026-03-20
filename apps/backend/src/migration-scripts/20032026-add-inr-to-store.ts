/**
 * Adds INR to the store's supported_currencies.
 *
 * Context: Initial seed only added USD and EUR. India region uses INR.
 * Without INR in supported_currencies, the pricing module fails to resolve
 * variant prices when adding to cart (calculated_amount undefined →
 * "Cannot read properties of undefined (reading 'calculated_amount')").
 */

import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils";
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows";

export default async function add_inr_to_store({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const storeModule = container.resolve(ModuleRegistrationName.STORE) as any;

  const [store] = await storeModule.listStores();
  if (!store) {
    logger.warn("[add-inr] No store found; skipping.");
    return;
  }

  const supported = (store.supported_currencies ?? []) as { currency_code: string }[];
  const hasInr = supported.some(
    (c) => c.currency_code?.toLowerCase() === "inr"
  );

  if (hasInr) {
    logger.info("[add-inr] INR already in supported_currencies; skipping.");
    return;
  }

  const updatedCurrencies = [
    ...supported,
    { currency_code: "inr", is_default: supported.length === 0 },
  ];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { supported_currencies: updatedCurrencies },
    },
  });

  logger.info("[add-inr] Added INR to store supported_currencies.");
}
