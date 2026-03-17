import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260317095819 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pharmacy_license" drop constraint if exists "pharmacy_license_license_number_unique";`);
    this.addSql(`create table if not exists "dpdp_consent" ("id" text not null, "customer_id" text null, "session_id" text null, "category" text check ("category" in ('essential', 'functional', 'analytics', 'marketing')) not null, "consented" boolean not null default false, "consent_given_at" timestamptz not null, "withdrawn_at" timestamptz null, "ip_address" text not null, "user_agent" text not null, "privacy_policy_version" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dpdp_consent_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dpdp_consent_deleted_at" ON "dpdp_consent" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "h1_register_entry" ("id" text not null, "entry_date" timestamptz not null, "patient_name" text not null, "patient_address" text not null, "patient_age" integer not null, "prescriber_name" text not null, "prescriber_reg_no" text not null, "drug_name" text not null, "brand_name" text not null, "batch_number" text not null, "quantity_dispensed" integer not null, "dispensing_pharmacist" text not null, "pharmacist_reg_no" text not null, "order_item_id" text not null, "dispense_decision_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "h1_register_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_h1_register_entry_deleted_at" ON "h1_register_entry" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "override_request" ("id" text not null, "override_type" text not null, "target_entity_type" text not null, "target_entity_id" text not null, "requested_by" text not null, "requested_by_role" text not null, "justification" text not null, "patient_impact" text null, "risk_assessment" text not null, "supporting_doc_url" text null, "requires_dual_auth" boolean not null default false, "primary_approver_id" text null, "primary_approved_at" timestamptz null, "secondary_approver_id" text null, "secondary_approved_at" timestamptz null, "status" text check ("status" in ('pending_primary', 'pending_secondary', 'approved', 'rejected', 'expired', 'used')) not null default 'pending_primary', "valid_for_hours" integer not null default 24, "expires_at" timestamptz not null, "used_at" timestamptz null, "notified_cdsco" boolean not null default false, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "override_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_override_request_deleted_at" ON "override_request" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pharmacy_license" ("id" text not null, "license_number" text not null, "license_type" text not null, "issued_by" text not null, "valid_from" timestamptz not null, "valid_until" timestamptz not null, "document_url" text null, "is_active" boolean not null default true, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pharmacy_license_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pharmacy_license_license_number_unique" ON "pharmacy_license" ("license_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_license_deleted_at" ON "pharmacy_license" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "phi_audit_log" ("id" text not null, "user_id" text not null, "role" text not null, "action" text check ("action" in ('read', 'write', 'update', 'export', 'print')) not null, "entity_type" text not null, "entity_id" text not null, "ip_address" text not null, "user_agent" text not null, "access_granted" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "phi_audit_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_phi_audit_log_deleted_at" ON "phi_audit_log" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dpdp_consent" cascade;`);

    this.addSql(`drop table if exists "h1_register_entry" cascade;`);

    this.addSql(`drop table if exists "override_request" cascade;`);

    this.addSql(`drop table if exists "pharmacy_license" cascade;`);

    this.addSql(`drop table if exists "phi_audit_log" cascade;`);
  }

}
