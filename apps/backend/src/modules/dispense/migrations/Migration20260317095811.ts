import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260317095811 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "dispense_decision" ("id" text not null, "prescription_drug_line_id" text not null, "pharmacist_id" text not null, "decision" text check ("decision" in ('approved', 'rejected', 'substituted', 'quantity_modified')) not null, "approved_variant_id" text null, "approved_quantity" integer not null default 0, "dispensing_notes" text null, "rejection_reason" text check ("rejection_reason" in ('out_of_stock', 'contraindication', 'interaction_risk', 'invalid_rx', 'schedule_restriction', 'other')) null, "h1_register_entry_id" text null, "decided_at" timestamptz not null, "is_override" boolean not null default false, "override_reason" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dispense_decision_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dispense_decision_deleted_at" ON "dispense_decision" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pharmacist_adjustment_log" ("id" text not null, "order_item_id" text not null, "pharmacist_id" text not null, "adjustment_type" text check ("adjustment_type" in ('quantity_change', 'substitution', 'rejection', 'schedule_override', 'interaction_override', 'pre_dispatch_approval')) not null, "previous_value" text not null, "new_value" text not null, "reason" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pharmacist_adjustment_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pharmacist_adjustment_log_deleted_at" ON "pharmacist_adjustment_log" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pharmacist_note" ("id" text not null, "prescription_id" text not null, "line_id" text null, "pharmacist_id" text not null, "note_text" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pharmacist_note_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pharmacist_note_deleted_at" ON "pharmacist_note" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pre_dispatch_sign_off" ("id" text not null, "order_id" text not null, "pharmacist_id" text not null, "checks_performed" jsonb not null, "approved" boolean not null default false, "rejection_reason" text null, "signed_off_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pre_dispatch_sign_off_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pre_dispatch_sign_off_deleted_at" ON "pre_dispatch_sign_off" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dispense_decision" cascade;`);

    this.addSql(`drop table if exists "pharmacist_adjustment_log" cascade;`);

    this.addSql(`drop table if exists "pharmacist_note" cascade;`);

    this.addSql(`drop table if exists "pre_dispatch_sign_off" cascade;`);
  }

}
