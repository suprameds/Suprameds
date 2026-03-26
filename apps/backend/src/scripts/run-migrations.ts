/**
 * Unified migration runner for Suprameds.
 *
 * Executes all data-seeding migration scripts in the correct order.
 * Each script is idempotent — safe to re-run on an existing database.
 *
 * NOTE: Medusa auto-discovers files in migration-scripts/ and runs them
 * in alphabetical order during `npx medusa db:migrate`. The numeric
 * prefixes (001–014) ensure correct execution order.
 *
 * This unified runner is a backup / manual tool:
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

import initialSeed from "../migration-scripts/001-initial-seed"
import indiaRegion from "../migration-scripts/002-india-region"
import indiaShippingOptions from "../migration-scripts/003-india-shipping-options"
import addInrToStore from "../migration-scripts/004-add-inr-to-store"
import razorpayRegionProviders from "../migration-scripts/005-razorpay-region-providers"
import addCodToRegion from "../migration-scripts/006-add-cod-to-region"
import supracynProducts from "../migration-scripts/007-supracyn-products"
import pharmacyCatalog from "../migration-scripts/008-pharmacy-taxonomy-and-sample-catalog"
import conditionalShipping from "../migration-scripts/009-conditional-shipping-option"
import fixShippingProfiles from "../migration-scripts/010-fix-shipping-profiles"
import cleanupManualShipping from "../migration-scripts/011-cleanup-manual-shipping"
import rbacBootstrap from "../migration-scripts/012-rbac-bootstrap"
import bootstrapSuperAdmin from "../migration-scripts/013-bootstrap-super-admin"
import ftsSearchVector from "../migration-scripts/014-fts-search-vector"
import seedProductBatches from "../migration-scripts/015-seed-product-batches"
import fixAllProductInventory from "../migration-scripts/017-fix-all-product-inventory"

interface MigrationStep {
  name: string
  fn: (ctx: { container: MedusaContainer }) => Promise<void>
  /** If true, skipped when SKIP_PRODUCT_SEED=true */
  isProductSeed?: boolean
}

const MIGRATIONS: MigrationStep[] = [
  {
    name: "1. Initial seed (India region, INR, GST 5%, stock, shipping)",
    fn: initialSeed,
  },
  {
    name: "2. India region + GST 5% (safety net / fix old 18% rate)",
    fn: indiaRegion,
  },
  {
    name: "3. India shipping options (geo-zone + INR price safety net)",
    fn: indiaShippingOptions,
  },
  {
    name: "4. Ensure INR is sole store currency",
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
    name: "7. Supracyn product catalog",
    fn: supracynProducts,
    isProductSeed: true,
  },
  {
    name: "8. Pharmacy taxonomy & sample catalog",
    fn: pharmacyCatalog,
    isProductSeed: true,
  },
  {
    name: "9. Conditional shipping option (₹50 / free above ₹300)",
    fn: conditionalShipping,
  },
  {
    name: "10. Fix shipping profiles on all products",
    fn: fixShippingProfiles,
  },
  {
    name: "11. Remove old manual shipping option (fixes fp_manual_manual error)",
    fn: cleanupManualShipping,
  },
  {
    name: "12. RBAC bootstrap (roles + permissions)",
    fn: rbacBootstrap,
  },
  {
    name: "13. Bootstrap super_admin account",
    fn: bootstrapSuperAdmin,
  },
  {
    name: "14. Full-text search vector + GIN index",
    fn: ftsSearchVector,
  },
  {
    name: "15. Seed product batches (2-3 per variant, FEFO testing)",
    fn: seedProductBatches,
    isProductSeed: true,
  },
  {
    name: "17. Fix all product inventory (items, levels, links, stock = 50)",
    fn: fixAllProductInventory,
    isProductSeed: true,
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
