import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260317095815 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "warehouse" drop constraint if exists "warehouse_code_unique";`);
    this.addSql(`alter table if exists "grn_record" drop constraint if exists "grn_record_grn_number_unique";`);
    this.addSql(`create table if not exists "grn_record" ("id" text not null, "grn_number" text not null, "supplier_id" text not null, "supplier_invoice_no" text not null, "received_by" text not null, "qc_approved_by" text null, "received_at" timestamptz not null, "qc_approved_at" timestamptz null, "items" jsonb not null, "status" text check ("status" in ('pending_qc', 'approved', 'partially_rejected', 'rejected')) not null default 'pending_qc', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "grn_record_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_grn_record_grn_number_unique" ON "grn_record" ("grn_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_grn_record_deleted_at" ON "grn_record" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pick_list_line" ("id" text not null, "task_id" text not null, "order_item_id" text not null, "allocation_id" text not null, "batch_id" text not null, "bin_id" text not null, "quantity_to_pick" integer not null, "quantity_picked" integer not null default 0, "status" text check ("status" in ('pending', 'picked', 'short_pick', 'exception')) not null default 'pending', "picked_by" text null, "picked_at" timestamptz null, "exception_reason" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pick_list_line_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pick_list_line_deleted_at" ON "pick_list_line" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "returns_inspection" ("id" text not null, "order_item_id" text not null, "batch_id" text not null, "return_reason" text check ("return_reason" in ('wrong_product', 'damaged', 'recalled', 'near_expiry', 'other')) not null, "result" text check ("result" in ('saleable', 'damaged', 'opened', 'near_expiry', 'recalled', 'doubtful')) not null, "action_taken" text check ("action_taken" in ('restocked', 'quarantined', 'destroyed')) not null, "approved_by" text not null, "evidence_urls" jsonb null, "inspected_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "returns_inspection_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_returns_inspection_deleted_at" ON "returns_inspection" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "supplier" ("id" text not null, "supplier_name" text not null, "drug_license_no" text not null, "gst_number" text not null, "contact_person" text null, "phone" text null, "email" text null, "address" jsonb null, "payment_terms" text null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supplier_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_supplier_deleted_at" ON "supplier" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "warehouse" ("id" text not null, "name" text not null, "code" text not null, "drug_license_no" text not null, "gst_registration" text not null, "manager_id" text not null, "address" jsonb null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "warehouse_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_warehouse_code_unique" ON "warehouse" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_warehouse_deleted_at" ON "warehouse" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "warehouse_bin" ("id" text not null, "zone_id" text not null, "bin_code" text not null, "bin_barcode" text not null, "capacity_units" integer not null default 0, "current_units" integer not null default 0, "is_active" boolean not null default true, "last_audit_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "warehouse_bin_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_warehouse_bin_deleted_at" ON "warehouse_bin" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "warehouse_task" ("id" text not null, "task_type" text check ("task_type" in ('receive', 'inspect', 'put_away', 'pick', 'pack', 'pre_dispatch_check', 'dispatch', 'return_inspect', 'cycle_count')) not null, "reference_type" text not null, "reference_id" text not null, "assigned_to" text null, "warehouse_id" text not null, "priority" text check ("priority" in ('low', 'normal', 'high', 'urgent')) not null default 'normal', "status" text check ("status" in ('pending', 'assigned', 'in_progress', 'completed', 'exception')) not null default 'pending', "started_at" timestamptz null, "completed_at" timestamptz null, "exception_notes" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "warehouse_task_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_warehouse_task_deleted_at" ON "warehouse_task" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "warehouse_zone" ("id" text not null, "warehouse_id" text not null, "zone_code" text not null, "zone_type" text check ("zone_type" in ('ambient', 'quarantine', 'controlled_access', 'receiving', 'dispatch', 'returns')) not null, "access_level" text check ("access_level" in ('open', 'pharmacist_key', 'dual_key')) not null default 'open', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "warehouse_zone_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_warehouse_zone_deleted_at" ON "warehouse_zone" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "grn_record" cascade;`);

    this.addSql(`drop table if exists "pick_list_line" cascade;`);

    this.addSql(`drop table if exists "returns_inspection" cascade;`);

    this.addSql(`drop table if exists "supplier" cascade;`);

    this.addSql(`drop table if exists "warehouse" cascade;`);

    this.addSql(`drop table if exists "warehouse_bin" cascade;`);

    this.addSql(`drop table if exists "warehouse_task" cascade;`);

    this.addSql(`drop table if exists "warehouse_zone" cascade;`);
  }

}
