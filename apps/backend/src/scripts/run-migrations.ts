/**
 * Unified migration runner for Suprameds.
 *
 * Executes all data-seeding migration scripts in the correct order.
 * Each script is idempotent — safe to re-run on an existing database.
 *
 * Usage:
 *   npx medusa exec ./src/scripts/run-migrations.ts
 *
 * Prerequisites:
 *   - `npx medusa db:migrate` must be run first (MikroORM schema migrations)
 *   - Environment variables must be set (DATABASE_URL, RAZORPAY_*, etc.)
 *
 * To skip product seeding (e.g. on production):
 *   SKIP_PRODUCT_SEED=true npx medusa exec ./src/scripts/run-migrations.ts
 */

import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Migration scripts in execution order
import initialSeed from "../migration-scripts/25022026-initial-seed"
import indiaRegion from "../migration-scripts/21032026-india-region"
import indiaShippingOptions from "../migration-scripts/18032026-india-shipping-options"
import addInrToStore from "../migration-scripts/20032026-add-inr-to-store"
import razorpayRegionProviders from "../migration-scripts/19032026-razorpay-region-providers"
import addCodToRegion from "../migration-scripts/20032026-add-cod-to-region"
import pharmacyCatalog from "../migration-scripts/18032026-pharmacy-taxonomy-and-sample-catalog"
import conditionalShipping from "../migration-scripts/22032026-conditional-shipping-option"
import rbacBootstrap from "../migration-scripts/22032026-rbac-bootstrap"
import fixShippingProfiles from "../migration-scripts/23032026-fix-shipping-profiles"
import cleanupManualShipping from "../migration-scripts/23032026-cleanup-manual-shipping"
import ftsSearchVector from "../migration-scripts/20032026-fts-search-vector"

interface MigrationStep {
  name: string
  fn: (ctx: { container: MedusaContainer }) => Promise<void>
  /** If true, skipped when SKIP_PRODUCT_SEED=true */
  isProductSeed?: boolean
}

const MIGRATIONS: MigrationStep[] = [
  {
    name: "1. Initial seed (defaults, regions, stock, shipping)",
    fn: initialSeed,
  },
  {
    name: "2. India region + GST tax",
    fn: indiaRegion,
  },
  {
    name: "3. India shipping options (geo-zone + INR price)",
    fn: indiaShippingOptions,
  },
  {
    name: "4. Add INR to store supported currencies",
    fn: addInrToStore,
  },
  {
    name: "5. Razorpay payment provider on all regions",
    fn: razorpayRegionProviders,
  },
  {
    name: "6. Add COD (system_default) alongside Razorpay",
    fn: addCodToRegion,
  },
  {
    name: "7. Pharmacy taxonomy & sample catalog",
    fn: pharmacyCatalog,
    isProductSeed: true,
  },
  {
    name: "8. Conditional shipping option (₹50 / free above ₹300)",
    fn: conditionalShipping,
  },
  {
    name: "9. Fix shipping profiles on all products",
    fn: fixShippingProfiles,
  },
  {
    name: "10. Remove old manual shipping option (fixes fp_manual_manual error)",
    fn: cleanupManualShipping,
  },
  {
    name: "11. RBAC bootstrap (roles + permissions)",
    fn: rbacBootstrap,
  },
  {
    name: "12. Full-text search vector + GIN index",
    fn: ftsSearchVector,
  },
]

export default async function runMigrations({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const skipProducts = process.env.SKIP_PRODUCT_SEED === "true"

  logger.info("╔══════════════════════════════════════════════════╗")
  logger.info("║       SUPRAMEDS — Unified Migration Runner      ║")
  logger.info("╚══════════════════════════════════════════════════╝")
  logger.info("")

  const total = MIGRATIONS.length
  let completed = 0
  let skipped = 0
  let failed = 0

  for (const step of MIGRATIONS) {
    if (skipProducts && step.isProductSeed) {
      logger.info(`⏭  SKIP: ${step.name} (SKIP_PRODUCT_SEED=true)`)
      skipped++
      continue
    }

    logger.info(`▶  START: ${step.name}`)
    const start = Date.now()

    try {
      await step.fn({ container })
      const elapsed = Date.now() - start
      logger.info(`✓  DONE:  ${step.name} (${elapsed}ms)`)
      completed++
    } catch (err) {
      const elapsed = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`✗  FAIL:  ${step.name} (${elapsed}ms) — ${msg}`)
      failed++
      // Continue with remaining migrations even if one fails
    }

    logger.info("")
  }

  logger.info("──────────────────────────────────────────────────")
  logger.info(
    `Migration summary: ${completed}/${total} completed, ${skipped} skipped, ${failed} failed`
  )

  if (failed > 0) {
    logger.warn(
      "Some migrations failed. Check the logs above and re-run after fixing."
    )
  } else {
    logger.info("All migrations completed successfully!")
  }
}
