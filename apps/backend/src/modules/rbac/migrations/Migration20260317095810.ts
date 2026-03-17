import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260317095810 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "role" drop constraint if exists "role_code_unique";`);
    this.addSql(`create table if not exists "permission" ("id" text not null, "resource" text not null, "action" text not null, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "permission_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_permission_deleted_at" ON "permission" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "role" ("id" text not null, "name" text not null, "code" text not null, "description" text null, "is_clinical" boolean not null default false, "requires_mfa" boolean not null default false, "is_active" boolean not null default true, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "role_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_role_code_unique" ON "role" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_role_deleted_at" ON "role" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "role_audit_log" ("id" text not null, "user_id" text not null, "role_id" text not null, "action" text check ("action" in ('assign', 'revoke')) not null, "performed_by" text not null, "reason" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "role_audit_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_role_audit_log_deleted_at" ON "role_audit_log" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "user_role" ("id" text not null, "user_id" text not null, "role_id" text not null, "assigned_by" text not null, "reason" text null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "user_role_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_user_role_deleted_at" ON "user_role" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "permission" cascade;`);

    this.addSql(`drop table if exists "role" cascade;`);

    this.addSql(`drop table if exists "role_audit_log" cascade;`);

    this.addSql(`drop table if exists "user_role" cascade;`);
  }

}
