/**
 * Database Reset Script
 *
 * Drops ALL public schema tables and recreates the database from scratch.
 * Use this before running `db:setup` to get a perfectly clean state.
 *
 * Usage:
 *   npx medusa exec ./src/scripts/db-reset.ts
 *
 * Then run:
 *   npm run db:setup
 *
 * WARNING: This destroys ALL data. Only use for dev/staging resets.
 */
import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function dbReset({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pgConnection = container.resolve("pgConnection") as any

  logger.warn("╔══════════════════════════════════════════════════╗")
  logger.warn("║    SUPRAMEDS — DATABASE RESET (DESTRUCTIVE!)    ║")
  logger.warn("╚══════════════════════════════════════════════════╝")
  logger.warn("")

  try {
    logger.info("Dropping all tables in 'public' schema...")

    await pgConnection.raw(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        -- Drop all tables
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;

        -- Drop all types/enums
        FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e') LOOP
          EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;

        -- Drop all functions
        FOR r IN (SELECT proname, oidvectortypes(proargtypes) as args
                  FROM pg_proc WHERE pronamespace = 'public'::regnamespace) LOOP
          EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
        END LOOP;

        -- Drop all sequences
        FOR r IN (SELECT relname FROM pg_class WHERE relkind = 'S' AND relnamespace = 'public'::regnamespace) LOOP
          EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.relname) || ' CASCADE';
        END LOOP;
      END $$;
    `)

    logger.info("All tables, types, functions, and sequences dropped.")
    logger.info("")
    logger.info("Next steps:")
    logger.info("  1. npx medusa db:migrate   (recreate schema)")
    logger.info("  2. npm run db:seed          (run all seed/migration scripts)")
    logger.info("")
    logger.info("Or in one command:")
    logger.info("  npm run db:setup")
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(`Database reset failed: ${msg}`)
    throw err
  }
}
