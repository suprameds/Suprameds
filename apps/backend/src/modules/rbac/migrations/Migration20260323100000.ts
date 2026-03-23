import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260323100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "mfa_secret" ("id" text not null, "user_id" text not null, "secret" text not null, "is_verified" boolean not null default false, "backup_codes" jsonb null, "last_verified_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "mfa_secret_pkey" primary key ("id"));`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_mfa_secret_user_id_unique" ON "mfa_secret" ("user_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_mfa_secret_deleted_at" ON "mfa_secret" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "mfa_secret" cascade;`)
  }
}
