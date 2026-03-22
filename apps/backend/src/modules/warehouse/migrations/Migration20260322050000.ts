import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260322050000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "serviceable_pincode" (
      "id" text not null,
      "pincode" text not null,
      "officename" text not null,
      "officetype" text null,
      "delivery" text not null,
      "district" text not null,
      "statename" text not null,
      "divisionname" text null,
      "regionname" text null,
      "circlename" text null,
      "latitude" text null,
      "longitude" text null,
      "is_serviceable" boolean not null default true,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "serviceable_pincode_pkey" primary key ("id")
    );`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_serviceable_pincode_pincode" ON "serviceable_pincode" ("pincode") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_serviceable_pincode_statename" ON "serviceable_pincode" ("statename") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_serviceable_pincode_district" ON "serviceable_pincode" ("district") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_serviceable_pincode_deleted_at" ON "serviceable_pincode" ("deleted_at") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "serviceable_pincode" cascade;`)
  }
}
