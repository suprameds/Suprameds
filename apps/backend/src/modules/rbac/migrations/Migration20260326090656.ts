import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260326090656 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "mfa_secret" drop constraint if exists "mfa_secret_user_id_unique";`);
    this.addSql(`create table if not exists "invite_role" ("id" text not null, "email" text not null, "role_code" text not null, "invited_by" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "invite_role_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_invite_role_deleted_at" ON "invite_role" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "mfa_secret" ("id" text not null, "user_id" text not null, "secret" text not null, "is_verified" boolean not null default false, "backup_codes" jsonb null, "last_verified_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "mfa_secret_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_mfa_secret_user_id_unique" ON "mfa_secret" ("user_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_mfa_secret_deleted_at" ON "mfa_secret" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "staff_credential" ("id" text not null, "user_id" text not null, "credential_type" text check ("credential_type" in ('pharmacist_registration', 'mci_registration', 'drug_license', 'other')) not null, "credential_value" text not null, "holder_name" text not null, "issuing_authority" text null, "valid_from" timestamptz null, "valid_until" timestamptz null, "is_verified" boolean not null default false, "verified_by" text null, "verified_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "staff_credential_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_staff_credential_deleted_at" ON "staff_credential" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "invite_role" cascade;`);

    this.addSql(`drop table if exists "mfa_secret" cascade;`);

    this.addSql(`drop table if exists "staff_credential" cascade;`);
  }

}
