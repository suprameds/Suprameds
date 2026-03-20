/**
 * Adds PostgreSQL Full-Text Search (FTS) capability to the `product` table.
 *
 * - Adds a `search_vector` tsvector column
 * - Creates a GIN index for fast FTS lookups
 * - Creates a trigger that auto-updates `search_vector` on INSERT/UPDATE
 * - Backfills existing rows
 *
 * This is a raw SQL migration executed via the Medusa container's
 * __pg_connection__ (the underlying Knex/pg pool), NOT a MikroORM migration.
 */

import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function migration_20032026_fts_search_vector({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pgConnection = container.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  )

  logger.info("[fts] Starting full-text search migration...")

  // 1. Add the tsvector column (idempotent — skips if it already exists)
  await pgConnection.raw(`
    ALTER TABLE "product"
    ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
  `)
  logger.info("[fts] Added search_vector column to product table.")

  // 2. Create GIN index for fast full-text lookups
  await pgConnection.raw(`
    CREATE INDEX IF NOT EXISTS "IDX_product_search_vector"
    ON "product" USING gin ("search_vector");
  `)
  logger.info("[fts] Created GIN index on product.search_vector.")

  // 3. Create or replace the trigger function that builds the tsvector
  //    Weights: title(A) > subtitle(B) > description(C) > handle(D)
  await pgConnection.raw(`
    CREATE OR REPLACE FUNCTION product_search_vector_update() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.subtitle, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.handle, '')), 'D');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)
  logger.info("[fts] Created product_search_vector_update() function.")

  // 4. Attach the trigger (drop first for idempotency)
  await pgConnection.raw(`
    DROP TRIGGER IF EXISTS trg_product_search_vector ON "product";

    CREATE TRIGGER trg_product_search_vector
    BEFORE INSERT OR UPDATE OF title, subtitle, description, handle
    ON "product"
    FOR EACH ROW
    EXECUTE FUNCTION product_search_vector_update();
  `)
  logger.info("[fts] Attached trigger trg_product_search_vector on product.")

  // 5. Backfill existing rows
  const result = await pgConnection.raw(`
    UPDATE "product"
    SET search_vector =
      setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(subtitle, '')), 'B') ||
      setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
      setweight(to_tsvector('english', COALESCE(handle, '')), 'D')
    WHERE search_vector IS NULL;
  `)
  const backfilled = result?.rowCount ?? result?.[0]?.rowCount ?? "unknown"
  logger.info(`[fts] Backfilled ${backfilled} existing product rows.`)

  logger.info("[fts] Full-text search migration complete.")
}
