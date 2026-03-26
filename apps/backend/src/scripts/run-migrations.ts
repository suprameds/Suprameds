/**
 * Unified migration runner for Suprameds.
 *
 * Executes all data-seeding migration scripts in the correct order.
 * Each script is idempotent — safe to re-run on an existing database.
 *
 * Production-ready: only essential scripts are included.
 *
 *   npx medusa exec ./src/scripts/run-migrations.ts
 *
 * Prerequisites:
 *   - `npx medusa db:migrate` must be run first (MikroORM schema migrations)
 *   - Environment variables must be set (DATABASE_URL, RAZORPAY_*, etc.)
 *
 * To skip product seeding (e.g. on production after initial setup):
 *   SKIP_PRODUCT_SEED=true npx medusa exec ./src/scripts/run-migrations.ts
 */

import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import initialSeed from "../migration-scripts/001-initial-seed"
import supracynProducts from "../migration-scripts/007-supracyn-products"
import conditionalShipping from "../migration-scripts/009-conditional-shipping-option"
import rbacBootstrap from "../migration-scripts/012-rbac-bootstrap"
import bootstrapSuperAdmin from "../migration-scripts/013-bootstrap-super-admin"
import ftsSearchVector from "../migration-scripts/014-fts-search-vector"
import seedProductBatches from "../migration-scripts/015-seed-product-batches"
import fixAllProductInventory from "../migration-scripts/017-fix-all-product-inventory"
import removeSampleProducts from "../migration-scripts/018-remove-sample-products"
import fixCloudInventory from "../migration-scripts/019-fix-cloud-inventory"

interface MigrationStep {
  name: string
  fn: (ctx: { container: MedusaContainer }) => Promise<void>
  /** If true, skipped when SKIP_PRODUCT_SEED=true */
  isProductSeed?: boolean
}

const MIGRATIONS: MigrationStep[] = [
  {
    name: "1. Initial seed (India region, INR, GST 5%, warehouse, shipping, fulfillment)",
    fn: initialSeed,
  },
  {
    name: "2. Supracyn product catalog (41 products + inventory)",
    fn: supracynProducts,
    isProductSeed: true,
  },
  {
    name: "3. Conditional shipping (free above ₹300, else ₹50)",
    fn: conditionalShipping,
  },
  {
    name: "4. RBAC bootstrap (roles + permissions)",
    fn: rbacBootstrap,
  },
  {
    name: "5. Super admin account (admin@suprameds.in)",
    fn: bootstrapSuperAdmin,
  },
  {
    name: "6. Full-text search vector + GIN index",
    fn: ftsSearchVector,
  },
  {
    name: "7. Seed product batches (2-3 per variant, FEFO)",
    fn: seedProductBatches,
    isProductSeed: true,
  },
  {
    name: "8. Fix all product inventory (items, levels, links, stock = 50)",
    fn: fixAllProductInventory,
    isProductSeed: true,
  },
  {
    name: "9. Remove sample products (cleanup old 008 data)",
    fn: removeSampleProducts,
  },
  {
    name: "10. Fix cloud inventory (batches + stock levels + links)",
    fn: fixCloudInventory,
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
