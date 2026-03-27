import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260327120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "cod_refund_details" ("id" text not null, "refund_id" text not null, "account_holder_name" text not null, "bank_name" text not null, "account_number" text not null, "ifsc_code" text not null, "upi_id" text null, "verified" boolean not null default false, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cod_refund_details_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cod_refund_details_deleted_at" ON "cod_refund_details" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cod_refund_details_refund_id" ON "cod_refund_details" ("refund_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cod_refund_details" cascade;`);
  }

}
