/**
 * Unified migration runner for Suprameds (v2).
 *
 * Executes consolidated data-seeding migration scripts in the correct order.
 * Tracks completed migrations in a `_seed_migrations` table so scripts are
 * not re-run on subsequent deploys.
 *
 *   npx medusa exec ./src/scripts/run-migrations.ts
 *
 * Environment variables:
 *   FORCE_RESEED=true        — Ignore tracking table and re-run all scripts (local dev)
 *
 * Prerequisites:
 *   - `npx medusa db:migrate` must run first (MikroORM schema migrations)
 */

import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import resetData from "../migration-scripts/000-reset-data"
import infraSeed from "../migration-scripts/001-infra-seed"
import rbacSeed from "../migration-scripts/002-rbac-seed"
import ftsIndex from "../migration-scripts/003-fts-index"
import cloudAdminBootstrap from "../migration-scripts/004-cloud-admin-bootstrap"
import seedProducts from "../migration-scripts/005-seed-products"

interface MigrationStep {
  name: string
  fn: (ctx: { container: MedusaContainer }) => Promise<void>
}

const MIGRATIONS: MigrationStep[] = [
  { name: "001-infra-seed", fn: infraSeed },
  { name: "002-rbac-seed", fn: rbacSeed },
  { name: "003-fts-index", fn: ftsIndex },
  { name: "004-cloud-admin-bootstrap", fn: cloudAdminBootstrap },
  { name: "005-seed-products", fn: seedProducts },
]

export default async function runMigrations({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const resetDb = process.env.RESET_DATABASE === "true"
  const forceReseed = process.env.FORCE_RESEED === "true" || resetDb

  // 0. Optionally reset all data (RESET_DATABASE=true)
  if (resetDb) {
    await resetData({ container })
  }

  // 1. Create tracking table (idempotent)
  await pgConnection.raw(`
    CREATE TABLE IF NOT EXISTS _seed_migrations (
      name VARCHAR(255) PRIMARY KEY,
      ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // 2. Banner
  logger.info("╔══════════════════════════════════════════════════╗")
  logger.info("║       SUPRAMEDS — Migration Runner v2           ║")
  logger.info("╚══════════════════════════════════════════════════╝")
  logger.info(`  FORCE_RESEED = ${forceReseed}`)
  logger.info(`  RESET_DATABASE = ${resetDb}`)

  let completed = 0
  let skipped = 0
  let failed = 0

  for (const step of MIGRATIONS) {
    // Check tracking table (unless force reseed)
    if (!forceReseed) {
      const { rows } = await pgConnection.raw(
        `SELECT 1 FROM _seed_migrations WHERE name = ?`,
        [step.name]
      )
      if (rows.length > 0) {
        logger.info(`⏭  SKIP: ${step.name} (already ran)`)
        skipped++
        continue
      }
    }

    // Run the migration
    logger.info(`▶  START: ${step.name}`)
    const start = Date.now()

    try {
      await step.fn({ container })
      const elapsed = Date.now() - start

      // Record in tracking table
      await pgConnection.raw(
        `INSERT INTO _seed_migrations (name) VALUES (?) ON CONFLICT (name) DO UPDATE SET ran_at = NOW()`,
        [step.name]
      )

      logger.info(`✓  DONE:  ${step.name} (${elapsed}ms)`)
      completed++
    } catch (err) {
      const elapsed = Date.now() - start
      const msg =
        err instanceof Error ? err.message : JSON.stringify(err, null, 2)
      logger.error(`✗  FAIL:  ${step.name} (${elapsed}ms) — ${msg}`)
      failed++
    }
  }

  logger.info("──────────────────────────────────────────────────")
  logger.info(
    `Summary: ${completed} completed, ${skipped} skipped, ${failed} failed`
  )

  if (failed > 0) {
    logger.error(`${failed} migration(s) failed — check logs above.`)
    throw new Error(`${failed} migration(s) failed`)
  } else {
    logger.info("All migrations completed successfully!")
  }
}
