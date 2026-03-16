import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260316043320 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "prescription" ("id" text not null, "customer_id" text null, "guest_phone" text null, "file_key" text not null, "file_url" text null, "original_filename" text null, "mime_type" text null, "file_size_bytes" integer null, "status" text check ("status" in ('pending_review', 'approved', 'rejected', 'expired', 'used')) not null default 'pending_review', "reviewed_by" text null, "reviewed_at" timestamptz null, "rejection_reason" text null, "doctor_name" text null, "doctor_reg_no" text null, "patient_name" text null, "prescribed_on" timestamptz null, "valid_until" timestamptz null, "fully_dispensed" boolean not null default false, "pharmacist_notes" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "prescription_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_prescription_deleted_at" ON "prescription" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "prescription_line" ("id" text not null, "prescription_id" text not null, "product_variant_id" text not null, "product_id" text not null, "approved_quantity" integer not null default 1, "dispensed_quantity" integer not null default 0, "max_refills" integer null, "refills_used" integer not null default 0, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "prescription_line_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_prescription_line_prescription_id" ON "prescription_line" ("prescription_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_prescription_line_deleted_at" ON "prescription_line" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "prescription_line" add constraint "prescription_line_prescription_id_foreign" foreign key ("prescription_id") references "prescription" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "prescription_line" drop constraint if exists "prescription_line_prescription_id_foreign";`);

    this.addSql(`drop table if exists "prescription" cascade;`);

    this.addSql(`drop table if exists "prescription_line" cascade;`);
  }

}
