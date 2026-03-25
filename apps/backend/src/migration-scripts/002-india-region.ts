/**
 * Ensures the India region exists with INR currency and GST 5% tax.
 *
 * Pharma formulations in India attract 5% GST (Schedule I of GST Rates).
 * If the initial seed already created the region and tax, this script
 * acts as a safety net and corrects any wrong tax rate (e.g. 18% → 5%).
 *
 * Idempotent — safe to re-run.
 */

import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  createTaxRegionsWorkflow,
} from "@medusajs/medusa/core-flows"

const RAZORPAY_PROVIDER_ID = "pp_razorpay_razorpay"
const SYSTEM_DEFAULT_ID = "pp_system_default"
const MEDICINE_GST_RATE = 5

export default async function createIndiaRegion({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // ── Region check ─────────────────────────────────────────────────────
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
      `[india-region] India region already exists: ${indiaRegion.name} (${indiaRegion.id}); skipping region creation.`
    )
  } else {
    const paymentProviders: string[] = []
    try {
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
      logger.info(`[india-region] Created India region: ${result[0].id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("Payment providers") || msg.includes("not found")) {
        logger.warn("[india-region] Razorpay not available; creating region with COD only.")
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
        logger.info(`[india-region] Created India region (COD only): ${result[0].id}`)
      } else {
        throw err
      }
    }
  }

  // ── Tax region — ensure GST 5% ───────────────────────────────────────
  const { data: existingTaxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
  })

  const indiaTaxRegion = (existingTaxRegions as any[])?.find(
    (tr) => tr.country_code === "in"
  )

  if (indiaTaxRegion) {
    // Tax region exists — check if the default rate is correct (5%)
    try {
      const { data: taxRates } = await query.graph({
        entity: "tax_rate",
        fields: ["id", "rate", "code", "name", "is_default", "tax_region_id"],
        filters: { tax_region_id: indiaTaxRegion.id, is_default: true },
      })

      const defaultRate = (taxRates as any[])?.[0]
      if (defaultRate && defaultRate.rate !== MEDICINE_GST_RATE) {
        logger.warn(
          `[india-region] India default tax rate is ${defaultRate.rate}% (expected ${MEDICINE_GST_RATE}%). ` +
          `Updating via direct service call...`
        )
        // Use the tax module service to update the rate
        const taxModuleService = container.resolve("tax") as any
        await taxModuleService.updateTaxRates(defaultRate.id, {
          rate: MEDICINE_GST_RATE,
          code: "GST5",
          name: "India GST (Medicines)",
        })
        logger.info(`[india-region] Updated India default tax rate to ${MEDICINE_GST_RATE}%.`)
      } else if (defaultRate) {
        logger.info(`[india-region] India tax rate already at ${MEDICINE_GST_RATE}%; skipping.`)
      } else {
        logger.warn("[india-region] No default tax rate found for India; will not create duplicate.")
      }
    } catch (err) {
      logger.warn(
        `[india-region] Could not verify/update India tax rate: ${err instanceof Error ? err.message : String(err)}. ` +
        `Verify manually in admin that the India default rate is ${MEDICINE_GST_RATE}%.`
      )
    }
  } else {
    logger.info(`[india-region] Creating India tax region (GST ${MEDICINE_GST_RATE}%)...`)
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "in",
          provider_id: "tp_system",
          default_tax_rate: {
            rate: MEDICINE_GST_RATE,
            code: "GST5",
            name: "India GST (Medicines)",
            is_default: true,
          },
        },
      ],
    })
    logger.info("[india-region] Created India tax region.")
  }
}
