/**
 * Full-Text Search (FTS) index for the product table.
 *
 * Adds PostgreSQL tsvector-based search to products for fast storefront queries.
 *
 * Steps (all idempotent via IF NOT EXISTS / CREATE OR REPLACE):
 *   1. Add `search_vector` tsvector column to `product` table
 *   2. Create GIN index `IDX_product_search_vector`
 *   3. Create/replace trigger function `product_search_vector_update`
 *      Weights: title(A) > subtitle(B) > description(C) > handle(D)
 *   4. Create trigger `trg_product_search_vector` on INSERT/UPDATE
 *   5. Backfill existing rows where search_vector IS NULL
 *
 * Uses raw SQL via pgConnection (Knex/pg pool), NOT MikroORM migrations.
 */

import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:003-fts-index")

export default async function ftsIndex({
  container,
}: {
  container: MedusaContainer
}) {
  const pgConnection = container.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  )

  logger.info("Starting full-text search migration...")

  // ── 1. Add the tsvector column (idempotent) ─────────────────────────────
  await pgConnection.raw(`
    ALTER TABLE "product"
    ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
  `)
  logger.info("Ensured search_vector column exists on product table.")

  // ── 2. Create GIN index for fast full-text lookups ──────────────────────
  await pgConnection.raw(`
    CREATE INDEX IF NOT EXISTS "IDX_product_search_vector"
    ON "product" USING gin ("search_vector");
  `)
  logger.info("Ensured GIN index IDX_product_search_vector exists.")

  // ── 3. Create or replace the trigger function ───────────────────────────
  //    Builds a weighted tsvector from product text fields.
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
  logger.info("Created/replaced product_search_vector_update() function.")

  // ── 4. Attach the trigger (drop first for idempotency) ──────────────────
  await pgConnection.raw(`
    DROP TRIGGER IF EXISTS trg_product_search_vector ON "product";

    CREATE TRIGGER trg_product_search_vector
    BEFORE INSERT OR UPDATE OF title, subtitle, description, handle
    ON "product"
    FOR EACH ROW
    EXECUTE FUNCTION product_search_vector_update();
  `)
  logger.info("Attached trigger trg_product_search_vector on product table.")

  // ── 5. Backfill existing rows ───────────────────────────────────────────
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
  logger.info(`Backfilled ${backfilled} existing product rows.`)

  logger.info("Full-text search migration complete.")
}
