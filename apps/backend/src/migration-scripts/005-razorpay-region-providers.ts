/**
 * Adds Razorpay as a payment provider to all regions.
 *
 * Context: medusa-config.ts registers Razorpay as the sole payment provider
 * (replacing pp_system_default). Regions created by the initial seed reference
 * pp_system_default, which no longer exists. This migration updates all regions
 * to use pp_razorpay_razorpay so checkout can proceed.
 *
 * Run: migrations run (via `npx medusa exec ./src/migration-scripts/...` or
 * standard migration flow).
 */

import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows";

const RAZORPAY_PROVIDER_ID = "pp_razorpay_razorpay";

export default async function razorpay_region_providers({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code"],
  });

  if (!regions?.length) {
    logger.info("[razorpay-region] No regions found; skipping.");
    return;
  }

  for (const region of regions as { id: string; name: string }[]) {
    try {
      await updateRegionsWorkflow(container).run({
        input: {
          selector: { id: region.id },
          update: {
            payment_providers: [RAZORPAY_PROVIDER_ID],
          },
        },
      });
      logger.info(
        `[razorpay-region] Added Razorpay to region: ${region.name} (${region.id})`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("not found") ||
        msg.includes("Payment providers with ids")
      ) {
        logger.warn(
          `[razorpay-region] Razorpay provider (${RAZORPAY_PROVIDER_ID}) not found. Ensure medusa-plugin-razorpay-v2 is installed and RAZORPAY_* env vars are set in .env. Run this migration after backend restart.`
        );
        return; // Skip remaining regions
      } else {
        throw err;
      }
    }
  }
}
