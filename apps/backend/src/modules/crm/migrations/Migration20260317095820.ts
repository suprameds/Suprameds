import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260317095820 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "chronic_reorder_pattern" ("id" text not null, "customer_id" text not null, "variant_id" text not null, "average_days_between_orders" integer not null, "last_purchased_at" timestamptz not null, "next_expected_at" timestamptz not null, "reminder_sent_at" timestamptz null, "confidence_score" integer not null default 0, "is_active" boolean not null default true, "detected_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "chronic_reorder_pattern_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_chronic_reorder_pattern_deleted_at" ON "chronic_reorder_pattern" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "chronic_reorder_pattern" cascade;`);
  }

}
