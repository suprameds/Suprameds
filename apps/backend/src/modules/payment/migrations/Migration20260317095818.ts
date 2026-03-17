import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260317095818 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "supply_memo" drop constraint if exists "supply_memo_memo_number_unique";`);
    this.addSql(`create table if not exists "payment_record" ("id" text not null, "order_id" text not null, "gateway" text check ("gateway" in ('razorpay', 'stripe', 'cod')) not null, "gateway_payment_id" text null, "payment_method" text check ("payment_method" in ('upi', 'card', 'netbanking', 'emi', 'cod', 'payment_link')) not null, "authorized_amount" integer not null default 0, "captured_amount" integer not null default 0, "released_amount" integer not null default 0, "refunded_amount" integer not null default 0, "status" text check ("status" in ('authorized', 'partially_captured', 'fully_captured', 'partially_refunded', 'fully_refunded', 'failed', 'voided', 'cod_pending')) not null default 'authorized', "captured_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_record_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_record_deleted_at" ON "payment_record" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "refund" ("id" text not null, "payment_id" text not null, "order_id" text not null, "raised_by" text not null, "approved_by" text null, "reason" text check ("reason" in ('rejected_rx_line', 'cancelled_order', 'return', 'batch_recall', 'payment_capture_error', 'cod_non_delivery', 'other')) not null, "amount" integer not null, "status" text check ("status" in ('pending_approval', 'approved', 'rejected', 'processed')) not null default 'pending_approval', "gateway_refund_id" text null, "processed_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "refund_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_refund_deleted_at" ON "refund" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "supply_memo" ("id" text not null, "memo_number" text not null, "order_id" text not null, "shipment_id" text null, "customer_name" text not null, "customer_address" text not null, "prescription_ref" text null, "pharmacist_name" text not null, "pharmacist_reg" text not null, "pharmacy_license" text not null, "items" jsonb not null, "total_mrp" integer not null default 0, "total_discount" integer not null default 0, "total_gst" integer not null default 0, "total_payable" integer not null default 0, "payment_mode" text not null, "generated_at" timestamptz not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supply_memo_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_supply_memo_memo_number_unique" ON "supply_memo" ("memo_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_supply_memo_deleted_at" ON "supply_memo" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_record" cascade;`);

    this.addSql(`drop table if exists "refund" cascade;`);

    this.addSql(`drop table if exists "supply_memo" cascade;`);
  }

}
