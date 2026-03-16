import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260316043311 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "drug_product" drop constraint if exists "drug_product_product_id_unique";`);
    this.addSql(`create table if not exists "drug_product" ("id" text not null, "product_id" text not null, "schedule" text check ("schedule" in ('OTC', 'H', 'H1', 'X')) not null default 'OTC', "drug_class" text null, "cdsco_reg_no" text null, "manufacturer_license" text null, "generic_name" text not null, "therapeutic_class" text null, "dosage_form" text check ("dosage_form" in ('tablet', 'capsule', 'syrup', 'suspension', 'cream', 'drops', 'injection', 'inhaler', 'patch', 'other')) not null default 'tablet', "strength" text null, "composition" text null, "pack_size" text null, "unit_type" text check ("unit_type" in ('tablet', 'strip', 'bottle', 'tube', 'box', 'sachet', 'vial', 'ampoule')) not null default 'strip', "mrp_paise" numeric null, "gst_rate" integer not null default 12, "hsn_code" text null, "indications" text null, "contraindications" text null, "side_effects" text null, "drug_interactions" text null, "storage_instructions" text null, "dosage_instructions" text null, "pharmacist_reviewed" boolean not null default false, "pharmacist_reviewed_by" text null, "pharmacist_reviewed_at" timestamptz null, "requires_refrigeration" boolean not null default false, "is_narcotic" boolean not null default false, "habit_forming" boolean not null default false, "is_chronic" boolean not null default false, "metadata" jsonb null, "raw_mrp_paise" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "drug_product_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_drug_product_product_id_unique" ON "drug_product" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_drug_product_deleted_at" ON "drug_product" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "drug_product" cascade;`);
  }

}
