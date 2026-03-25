import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Adds the FEFO composite index and a version column for optimistic locking.
 *
 * The composite index accelerates the core FEFO query pattern:
 *   WHERE product_variant_id = ? AND status = 'active'
 *   ORDER BY expiry_date ASC
 *
 * The version column enables optimistic concurrency control on batch
 * quantity updates — prevents two simultaneous fulfillments from
 * overwriting each other's deductions.
 */
export class Migration20260325100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_batch_fefo
        ON batch (product_variant_id, status, expiry_date ASC, available_quantity)
        WHERE deleted_at IS NULL;
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_batch_deduction_order
        ON batch_deduction (order_id, deduction_type)
        WHERE deleted_at IS NULL;
    `)

    this.addSql(`
      ALTER TABLE batch
        ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS idx_batch_fefo;`)
    this.addSql(`DROP INDEX IF EXISTS idx_batch_deduction_order;`)
    this.addSql(`ALTER TABLE batch DROP COLUMN IF EXISTS version;`)
  }
}
