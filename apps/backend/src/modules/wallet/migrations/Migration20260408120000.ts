import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260408120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "wallet_account" drop constraint if exists "wallet_account_customer_id_unique";`);
    this.addSql(`create table if not exists "wallet_account" ("id" text not null, "customer_id" text not null, "balance" integer not null default 0, "currency_code" text not null default 'inr', "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "wallet_account_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wallet_account_customer_id_unique" ON "wallet_account" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wallet_account_deleted_at" ON "wallet_account" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "wallet_transaction" ("id" text not null, "account_id" text not null, "type" text check ("type" in ('credit', 'debit')) not null, "amount" integer not null, "reference_type" text check ("reference_type" in ('return', 'cancellation', 'manual', 'checkout')) not null, "reference_id" text null, "reason" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "wallet_transaction_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wallet_transaction_account_id" ON "wallet_transaction" ("account_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wallet_transaction_deleted_at" ON "wallet_transaction" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "wallet_account" cascade;`);
    this.addSql(`drop table if exists "wallet_transaction" cascade;`);
  }

}
