import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260408120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "signup_request" (
        "id" text not null,
        "email" text not null,
        "first_name" text not null,
        "last_name" text not null,
        "requested_role_code" text not null,
        "status" text check ("status" in ('pending', 'approved', 'rejected')) not null default 'pending',
        "user_id" text null,
        "reviewed_by" text null,
        "reviewed_at" timestamptz null,
        "rejection_reason" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "signup_request_pkey" primary key ("id")
      );
    `)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_signup_request_email" ON "signup_request" ("email");`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_signup_request_status" ON "signup_request" ("status");`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_signup_request_deleted_at" ON "signup_request" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "signup_request" cascade;`)
  }
}
