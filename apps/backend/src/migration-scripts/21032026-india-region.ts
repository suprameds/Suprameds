/**
 * Creates the India region (INR) with tax region (GST 18%).
 *
 * The initial seed (25022026) only creates US + Europe. This script
 * ensures India exists as a standalone region with the correct currency,
 * payment providers, and default GST tax rate.
 *
 * Idempotent — skips if an India region already exists.
 */

import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  createTaxRegionsWorkflow,
} from "@medusajs/medusa/core-flows"

const RAZORPAY_PROVIDER_ID = "pp_razorpay_razorpay"
const SYSTEM_DEFAULT_ID = "pp_system_default"

export default async function createIndiaRegion({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // Check if India region already exists
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  })

  const indiaRegion = (regions as any[])?.find((r) => {
    if (r.currency_code === "inr") return true
    return r.countries?.some((c: { iso_2: string }) => c.iso_2 === "in")
  })

  if (indiaRegion) {
    logger.info(
      `[india-region] India region already exists: ${indiaRegion.name} (${indiaRegion.id}); skipping.`
    )
    return
  }

  // Determine which payment providers are available
  const paymentProviders: string[] = []
  try {
    // Razorpay may not be configured in all environments
    paymentProviders.push(RAZORPAY_PROVIDER_ID)
  } catch { /* ignore */ }
  paymentProviders.push(SYSTEM_DEFAULT_ID)

  logger.info("[india-region] Creating India region with INR currency...")

  try {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "India",
            currency_code: "inr",
            countries: ["in"],
            payment_providers: paymentProviders,
            automatic_taxes: true,
            is_tax_inclusive: true,
          },
        ],
      },
    })
    logger.info(
      `[india-region] Created India region: ${result[0].id}`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // If Razorpay not found, retry with system_default only
    if (msg.includes("Payment providers") || msg.includes("not found")) {
      logger.warn(
        "[india-region] Razorpay provider not available; creating region with COD only."
      )
      const { result } = await createRegionsWorkflow(container).run({
        input: {
          regions: [
            {
              name: "India",
              currency_code: "inr",
              countries: ["in"],
              payment_providers: [SYSTEM_DEFAULT_ID],
              automatic_taxes: true,
              is_tax_inclusive: true,
            },
          ],
        },
      })
      logger.info(
        `[india-region] Created India region (COD only): ${result[0].id}`
      )
    } else {
      throw err
    }
  }

  // Create India tax region with GST 18%
  const { data: existingTaxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
  })

  const hasIndiaTax = (existingTaxRegions as any[])?.some(
    (tr) => tr.country_code === "in"
  )

  if (!hasIndiaTax) {
    logger.info("[india-region] Creating India tax region (GST 18%)...")
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "in",
          provider_id: "tp_system",
          default_tax_rate: {
            rate: 18,
            code: "GST18",
            name: "India GST",
            is_default: true,
          },
        },
      ],
    })
    logger.info("[india-region] Created India tax region.")
  } else {
    logger.info("[india-region] India tax region already exists; skipping.")
  }
}
