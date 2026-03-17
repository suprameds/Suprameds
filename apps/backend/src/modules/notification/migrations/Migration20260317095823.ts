import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260317095823 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "notification_template" drop constraint if exists "notification_template_template_code_unique";`);
    this.addSql(`create table if not exists "internal_notification" ("id" text not null, "user_id" text not null, "role_scope" text null, "type" text check ("type" in ('rx_pending', 'rx_sla_breach', 'stock_low', 'batch_expiry', 'cod_confirmation_due', 'grievance_sla', 'license_expiry', 'compliance_failure', 'dispatch_pending', 'pre_dispatch_due')) not null, "title" text not null, "body" text not null, "reference_type" text null, "reference_id" text null, "read" boolean not null default false, "read_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "internal_notification_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_internal_notification_deleted_at" ON "internal_notification" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "notification_template" ("id" text not null, "template_code" text not null, "channel" text check ("channel" in ('sms', 'whatsapp', 'email')) not null, "trigger_event" text not null, "dlt_template_id" text null, "dlt_registered" boolean not null default false, "dlt_registered_at" timestamptz null, "sender_id" text null, "template_text" text not null, "variables" jsonb null, "is_active" boolean not null default true, "is_rx_allowed" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "notification_template_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_notification_template_template_code_unique" ON "notification_template" ("template_code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_notification_template_deleted_at" ON "notification_template" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "internal_notification" cascade;`);

    this.addSql(`drop table if exists "notification_template" cascade;`);
  }

}
