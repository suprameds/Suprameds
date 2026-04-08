import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260408120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "customer_document" ("id" text not null, "customer_id" text not null, "document_type" text check ("document_type" in ('aadhaar', 'pan', 'driving_license', 'passport', 'voter_id')) not null, "file_key" text not null, "file_url" text not null, "original_filename" text not null, "status" text check ("status" in ('pending', 'approved', 'rejected')) not null default 'pending', "reviewed_by" text null, "reviewed_at" timestamptz null, "rejection_reason" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "customer_document_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_customer_document_customer_id" ON "customer_document" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_customer_document_status" ON "customer_document" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_customer_document_deleted_at" ON "customer_document" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "customer_document" cascade;`);
  }

}
