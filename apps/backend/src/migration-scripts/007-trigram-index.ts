/**
 * Trigram search support for fuzzy/typo-tolerant medicine name matching.
 *
 * Steps (all idempotent):
 *   1. Enable pg_trgm extension
 *   2. Create GIN trigram index on product.title
 *   3. Create GIN trigram index on drug_product.generic_name
 *   4. Create GIN trigram index on drug_product.composition
 *
 * This allows similarity-based search (e.g., "Paracetmol" → "Paracetamol")
 * as a fallback when PostgreSQL FTS returns 0 results.
 */

import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:007-trigram-index")

export default async function trigramIndex({
  container,
}: {
  container: MedusaContainer
}) {
  const pgConnection = container.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  )

  logger.info("Starting trigram search migration...")

  // ── 1. Enable pg_trgm extension ────────────────────────────────────────
  await pgConnection.raw(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
  logger.info("Ensured pg_trgm extension is enabled.")

  // ── 2. Trigram GIN index on product.title ──────────────────────────────
  await pgConnection.raw(`
    CREATE INDEX IF NOT EXISTS "IDX_product_title_trgm"
    ON "product" USING gin ("title" gin_trgm_ops);
  `)
  logger.info("Ensured trigram index IDX_product_title_trgm exists.")

  // ── 3. Trigram GIN index on drug_product.generic_name ──────────────────
  await pgConnection.raw(`
    CREATE INDEX IF NOT EXISTS "IDX_drug_product_generic_name_trgm"
    ON "drug_product" USING gin ("generic_name" gin_trgm_ops);
  `)
  logger.info("Ensured trigram index IDX_drug_product_generic_name_trgm exists.")

  // ── 4. Trigram GIN index on drug_product.composition ───────────────────
  await pgConnection.raw(`
    CREATE INDEX IF NOT EXISTS "IDX_drug_product_composition_trgm"
    ON "drug_product" USING gin ("composition" gin_trgm_ops);
  `)
  logger.info("Ensured trigram index IDX_drug_product_composition_trgm exists.")

  logger.info("Trigram search migration complete.")
}
