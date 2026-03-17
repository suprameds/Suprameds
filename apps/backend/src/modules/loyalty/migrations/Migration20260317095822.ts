import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260317095822 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "loyalty_account" drop constraint if exists "loyalty_account_customer_id_unique";`);
    this.addSql(`create table if not exists "loyalty_account" ("id" text not null, "customer_id" text not null, "points_balance" integer not null default 0, "tier" text check ("tier" in ('bronze', 'silver', 'gold', 'platinum')) not null default 'bronze', "lifetime_points" integer not null default 0, "referral_code" text null, "referred_by" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_account_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_loyalty_account_customer_id_unique" ON "loyalty_account" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_account_deleted_at" ON "loyalty_account" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "loyalty_transaction" ("id" text not null, "account_id" text not null, "type" text check ("type" in ('earn', 'burn', 'expire', 'adjust')) not null, "points" integer not null, "reference_type" text null, "reference_id" text null, "reason" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_transaction_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_transaction_deleted_at" ON "loyalty_transaction" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "loyalty_account" cascade;`);

    this.addSql(`drop table if exists "loyalty_transaction" cascade;`);
  }

}
