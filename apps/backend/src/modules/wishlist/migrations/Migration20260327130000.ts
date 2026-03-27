import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260327130000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "wishlist_item" ("id" text not null, "customer_id" text not null, "product_id" text not null, "variant_id" text null, "price_at_addition" integer not null default 0, "alert_enabled" boolean not null default false, "alert_threshold_pct" integer not null default 10, "last_alert_sent_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "wishlist_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wishlist_item_customer_id" ON "wishlist_item" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wishlist_item_product_id" ON "wishlist_item" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wishlist_item_deleted_at" ON "wishlist_item" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "wishlist_item" cascade;`);
  }

}
