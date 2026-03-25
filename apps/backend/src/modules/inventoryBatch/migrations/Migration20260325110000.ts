import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Creates the batch_audit_log table for immutable audit trail of
 * every batch mutation — required for CDSCO traceability and
 * internal change tracking.
 */
export class Migration20260325110000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "batch_audit_log" (
        "id" text NOT NULL,
        "batch_id" text NOT NULL,
        "action" text CHECK ("action" IN (
          'created', 'qty_adjusted', 'status_changed', 'field_edited',
          'deduction_sale', 'deduction_reversed', 'deduction_return',
          'fulfillment_override'
        )) NOT NULL DEFAULT 'field_edited',
        "field_name" text NULL,
        "old_value" text NULL,
        "new_value" text NULL,
        "actor_id" text NULL,
        "actor_type" text CHECK ("actor_type" IN ('admin', 'system', 'job', 'workflow')) NOT NULL DEFAULT 'system',
        "order_id" text NULL,
        "fulfillment_id" text NULL,
        "reason" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "batch_audit_log_pkey" PRIMARY KEY ("id")
      );
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_batch_audit_log_batch
        ON batch_audit_log (batch_id, created_at DESC)
        WHERE deleted_at IS NULL;
    `)

    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_batch_audit_log_order
        ON batch_audit_log (order_id)
        WHERE order_id IS NOT NULL AND deleted_at IS NULL;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "batch_audit_log" CASCADE;`)
  }
}
