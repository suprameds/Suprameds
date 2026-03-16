import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260316043331 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "batch" ("id" text not null, "product_variant_id" text not null, "product_id" text not null, "lot_number" text not null, "manufactured_on" timestamptz null, "expiry_date" timestamptz not null, "received_quantity" integer not null, "available_quantity" integer not null, "reserved_quantity" integer not null default 0, "batch_mrp_paise" numeric null, "purchase_price_paise" numeric null, "location_id" text null, "supplier_name" text null, "purchase_order_ref" text null, "grn_number" text null, "received_on" timestamptz null, "status" text check ("status" in ('active', 'quarantine', 'recalled', 'expired', 'depleted')) not null default 'active', "recall_reason" text null, "recalled_on" timestamptz null, "metadata" jsonb null, "raw_batch_mrp_paise" jsonb null, "raw_purchase_price_paise" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "batch_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_batch_deleted_at" ON "batch" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "batch_deduction" ("id" text not null, "batch_id" text not null, "order_line_item_id" text not null, "order_id" text not null, "quantity" integer not null, "deduction_type" text check ("deduction_type" in ('sale', 'return', 'adjustment', 'write_off')) not null default 'sale', "deducted_by" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "batch_deduction_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_batch_deduction_batch_id" ON "batch_deduction" ("batch_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_batch_deduction_deleted_at" ON "batch_deduction" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "batch_deduction" add constraint "batch_deduction_batch_id_foreign" foreign key ("batch_id") references "batch" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "batch_deduction" drop constraint if exists "batch_deduction_batch_id_foreign";`);

    this.addSql(`drop table if exists "batch" cascade;`);

    this.addSql(`drop table if exists "batch_deduction" cascade;`);
  }

}
