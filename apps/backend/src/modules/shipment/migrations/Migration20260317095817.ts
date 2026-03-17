import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260317095817 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "shipment" drop constraint if exists "shipment_shipment_number_unique";`);
    this.addSql(`create table if not exists "delivery_days_lookup" ("id" text not null, "origin_state" text not null, "dest_state" text not null, "city_type" text check ("city_type" in ('metro', 'tier2', 'tier3', 'rural')) not null default 'metro', "min_days" integer not null, "max_days" integer not null, "display_text" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_days_lookup_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_delivery_days_lookup_deleted_at" ON "delivery_days_lookup" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "delivery_otp_log" ("id" text not null, "shipment_id" text not null, "otp_code" text not null, "sent_to_phone" text not null, "attempts" integer not null default 0, "verified" boolean not null default false, "verified_at" timestamptz null, "failed_reason" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_otp_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_delivery_otp_log_deleted_at" ON "delivery_otp_log" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "shipment" ("id" text not null, "order_id" text not null, "shipment_number" text not null, "carrier" text not null default 'india-post', "service_type" text not null default 'speed-post', "awb_number" text null, "aftership_tracking_id" text null, "warehouse_id" text not null, "dispatched_at" timestamptz null, "dispatched_by" text null, "contains_rx_drug" boolean not null default false, "estimated_delivery" timestamptz null, "actual_delivery" timestamptz null, "delivery_attempts" integer not null default 0, "delivery_otp" text null, "delivery_otp_verified" boolean not null default false, "delivery_photo_url" text null, "delivered_to" text null, "status" text check ("status" in ('label_created', 'in_transit', 'out_for_delivery', 'delivery_attempted', 'delivered', 'ndr', 'rto_initiated', 'rto_delivered')) not null default 'label_created', "last_location" text null, "ndr_reason" text null, "ndr_action" text check ("ndr_action" in ('reattempt', 'rto')) null, "is_cod" boolean not null default false, "cod_amount" integer not null default 0, "cod_collected" boolean not null default false, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shipment_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipment_shipment_number_unique" ON "shipment" ("shipment_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipment_deleted_at" ON "shipment" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "shipment_item" ("id" text not null, "shipment_id" text not null, "order_item_id" text not null, "batch_id" text not null, "quantity_shipped" integer not null, "batch_number" text not null, "expiry_date" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shipment_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipment_item_deleted_at" ON "shipment_item" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "delivery_days_lookup" cascade;`);

    this.addSql(`drop table if exists "delivery_otp_log" cascade;`);

    this.addSql(`drop table if exists "shipment" cascade;`);

    this.addSql(`drop table if exists "shipment_item" cascade;`);
  }

}
