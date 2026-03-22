import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260322040000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "invite_role" ("id" text not null, "email" text not null, "role_code" text not null, "invited_by" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "invite_role_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_invite_role_email" ON "invite_role" ("email") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_invite_role_deleted_at" ON "invite_role" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "invite_role" cascade;`)
  }
}
