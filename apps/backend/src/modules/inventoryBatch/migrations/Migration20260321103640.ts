import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260321103640 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "purchase_order" ("id" text not null, "po_number" text not null, "supplier_name" text not null, "supplier_contact" text null, "supplier_invoice_number" text null, "order_date" timestamptz not null, "expected_delivery_date" timestamptz null, "received_date" timestamptz null, "status" text check ("status" in ('draft', 'ordered', 'received', 'partial', 'cancelled')) not null default 'draft', "grn_number" text null, "location_id" text null, "notes" text null, "total_items" integer not null default 0, "total_quantity" integer not null default 0, "total_cost_paise" numeric not null default 0, "created_by" text null, "received_by" text null, "metadata" jsonb null, "raw_total_cost_paise" jsonb not null default '{"value":"0","precision":20}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "purchase_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_order_deleted_at" ON "purchase_order" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "purchase_order_line" ("id" text not null, "purchase_order_id" text not null, "product_id" text not null, "product_variant_id" text not null, "product_name" text not null, "lot_number" text not null, "expiry_date" timestamptz not null, "manufactured_on" timestamptz null, "ordered_quantity" integer not null, "received_quantity" integer not null default 0, "mrp_paise" numeric null, "purchase_price_paise" numeric not null, "line_total_paise" numeric not null default 0, "batch_id" text null, "line_status" text check ("line_status" in ('pending', 'received', 'partial', 'rejected')) not null default 'pending', "rejection_reason" text null, "metadata" jsonb null, "raw_mrp_paise" jsonb null, "raw_purchase_price_paise" jsonb not null, "raw_line_total_paise" jsonb not null default '{"value":"0","precision":20}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "purchase_order_line_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_order_line_purchase_order_id" ON "purchase_order_line" ("purchase_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_purchase_order_line_deleted_at" ON "purchase_order_line" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "purchase_order_line" add constraint "purchase_order_line_purchase_order_id_foreign" foreign key ("purchase_order_id") references "purchase_order" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "purchase_order_line" drop constraint if exists "purchase_order_line_purchase_order_id_foreign";`);

    this.addSql(`drop table if exists "purchase_order" cascade;`);

    this.addSql(`drop table if exists "purchase_order_line" cascade;`);
  }

}
