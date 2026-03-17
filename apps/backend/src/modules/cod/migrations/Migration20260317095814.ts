import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260317095814 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cod_customer_score" drop constraint if exists "cod_customer_score_customer_id_unique";`);
    this.addSql(`create table if not exists "cod_customer_score" ("id" text not null, "customer_id" text not null, "total_cod_orders" integer not null default 0, "cod_rto_count" integer not null default 0, "cod_rto_rate" real not null default 0, "consecutive_rtos" integer not null default 0, "cod_eligible" boolean not null default true, "cod_limit" integer not null default 1000, "last_evaluated_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cod_customer_score_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cod_customer_score_customer_id_unique" ON "cod_customer_score" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cod_customer_score_deleted_at" ON "cod_customer_score" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "cod_order" ("id" text not null, "order_id" text not null, "cod_amount" integer not null, "surcharge_amount" integer not null, "confirmation_required" boolean not null default false, "status" text check ("status" in ('pending_confirmation', 'confirmed', 'dispatched', 'delivered_collected', 'rto', 'cancelled')) not null default 'pending_confirmation', "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cod_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cod_order_deleted_at" ON "cod_order" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cod_customer_score" cascade;`);

    this.addSql(`drop table if exists "cod_order" cascade;`);
  }

}
