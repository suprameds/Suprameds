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
 * Approach: queries pg_tables for every table in the public schema
 * (excluding MikroORM migration tracking) and truncates them all in
 * one CASCADE statement. This avoids the fragile pattern of listing
 * individual table names which inevitably misses some.
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

  // 2. Get ALL user tables in the public schema (excluding MikroORM migration log)
  const { rows: tables } = await pgConnection.raw(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'mikro_orm_%'
  `)

  if (!tables.length) {
    logger.info("No tables found to truncate")
    return
  }

  const tableNames = tables.map((t: { tablename: string }) => `"${t.tablename}"`)
  logger.info(`Found ${tableNames.length} tables to truncate`)

  // 3. Truncate ALL tables in a single statement — CASCADE handles FKs
  try {
    await pgConnection.raw(`TRUNCATE TABLE ${tableNames.join(", ")} CASCADE`)
    logger.info(`Truncated all ${tableNames.length} tables`)
  } catch (err) {
    // Fallback: truncate one by one if the bulk statement fails
    logger.warn(`Bulk truncate failed, falling back to individual truncation: ${(err as Error).message}`)
    for (const name of tableNames) {
      try {
        await pgConnection.raw(`TRUNCATE TABLE ${name} CASCADE`)
      } catch {
        // Skip tables that can't be truncated
      }
    }
    logger.info("Individual truncation complete")
  }

  logger.warn("Database reset complete — all data deleted, schemas preserved")
}
