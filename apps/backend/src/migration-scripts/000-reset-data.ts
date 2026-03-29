import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:000-reset-data")

/**
 * Nuclear database reset — truncates ALL data from ALL tables.
 *
 * Only runs when RESET_DATABASE=true is set. Designed for Medusa Cloud
 * where SSH access is unavailable.
 *
 * Preserves:
 *   - MikroORM migration tracking tables (mikro_orm_*)
 *   - Reference data tables (country, currency) — seeded by db:migrate,
 *     NOT by workflows. Without these, createRegionsWorkflow fails.
 *
 * Uses DISABLE/ENABLE TRIGGER to bypass FK constraints instead of CASCADE,
 * which would cascade-delete country data via region_country.
 */
export default async function resetData({ container }: { container: MedusaContainer }) {
  if (process.env.RESET_DATABASE !== "true") {
    logger.info("RESET_DATABASE not set — skipping reset")
    return
  }

  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  logger.warn("╔══════════════════════════════════════════════════╗")
  logger.warn("║  ⚠  DATABASE RESET — DELETING ALL DATA          ║")
  logger.warn("╚══════════════════════════════════════════════════╝")

  // 1. Drop the _seed_migrations tracking table so all seeds re-run
  await pgConnection.raw(`DROP TABLE IF EXISTS _seed_migrations`)
  logger.info("Dropped _seed_migrations table")

  // 2. Get all user tables EXCEPT reference data and migration tracking
  const PRESERVED_TABLES = ["country", "currency"]

  const { rows: tables } = await pgConnection.raw(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'mikro_orm_%'
      AND tablename NOT IN (${PRESERVED_TABLES.map(t => `'${t}'`).join(", ")})
  `)

  if (!tables.length) {
    logger.info("No tables found to truncate")
    return
  }

  const tableNames = tables.map((t: { tablename: string }) => t.tablename)
  logger.info(`Found ${tableNames.length} tables to truncate (preserving ${PRESERVED_TABLES.join(", ")})`)

  // 3. Disable FK triggers, truncate each table, re-enable triggers.
  //    This avoids CASCADE which would wipe the preserved country/currency tables.
  try {
    await pgConnection.raw(`SET session_replication_role = 'replica'`)

    for (const name of tableNames) {
      try {
        await pgConnection.raw(`TRUNCATE TABLE "${name}"`)
      } catch {
        // Table might not exist or be a view — skip
      }
    }

    await pgConnection.raw(`SET session_replication_role = 'origin'`)
    logger.info(`Truncated ${tableNames.length} tables`)
  } catch (err) {
    // Ensure triggers are re-enabled even on error
    await pgConnection.raw(`SET session_replication_role = 'origin'`).catch(() => {})
    logger.error(`Reset error: ${(err as Error).message}`)
    throw err
  }

  logger.warn("Database reset complete — all data deleted, reference tables preserved")
}
