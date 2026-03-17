import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260317095812 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "order_extension" drop constraint if exists "order_extension_order_id_unique";`);
    this.addSql(`alter table if exists "guest_session" drop constraint if exists "guest_session_session_token_unique";`);
    this.addSql(`create table if not exists "cs_placed_order" ("id" text not null, "order_id" text not null, "agent_id" text not null, "customer_id" text null, "customer_phone" text not null, "channel" text check ("channel" in ('whatsapp', 'phone', 'email', 'walk_in')) not null, "payment_method" text check ("payment_method" in ('cod', 'payment_link', 'prepaid_existing')) not null, "payment_link_id" text null, "notes" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cs_placed_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cs_placed_order_deleted_at" ON "cs_placed_order" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "guest_session" ("id" text not null, "session_token" text not null, "phone" text not null, "email" text null, "cart_id" text null, "expires_at" timestamptz not null, "converted_to" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "guest_session_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_guest_session_session_token_unique" ON "guest_session" ("session_token") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_guest_session_deleted_at" ON "guest_session" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "order_extension" ("id" text not null, "order_id" text not null, "is_rx_order" boolean not null default false, "is_guest_order" boolean not null default false, "is_cs_placed" boolean not null default false, "cs_agent_id" text null, "prescription_id" text null, "is_partial_approval" boolean not null default false, "payment_authorized_amount" integer not null default 0, "payment_captured_amount" integer not null default 0, "payment_released_amount" integer not null default 0, "is_cod" boolean not null default false, "cod_amount" integer not null default 0, "cod_confirmation_status" text check ("cod_confirmation_status" in ('not_required', 'pending', 'confirmed', 'auto_cancelled')) null, "cod_confirmed_at" timestamptz null, "cod_confirmed_by" text null, "cod_attempts" integer not null default 0, "partial_shipment_preference" text check ("partial_shipment_preference" in ('all_or_nothing', 'ship_available', 'customer_choice')) not null default 'all_or_nothing', "status" text check ("status" in ('pending_cod_confirmation', 'pending_rx_review', 'partially_approved', 'fully_approved', 'payment_captured', 'allocation_pending', 'pick_pending', 'packing', 'pending_dispatch_approval', 'dispatched', 'delivered', 'partially_fulfilled', 'cancelled', 'refunded')) not null default 'pending_rx_review', "cancellation_reason" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_extension_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_order_extension_order_id_unique" ON "order_extension" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_extension_deleted_at" ON "order_extension" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "order_state_history" ("id" text not null, "order_id" text not null, "from_status" text not null, "to_status" text not null, "changed_by" text not null, "reason" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_state_history_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_state_history_deleted_at" ON "order_state_history" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "partial_shipment_preference" ("id" text not null, "order_id" text not null, "customer_id" text not null, "choice" text check ("choice" in ('ship_available', 'wait_for_all', 'cancel_oos_item')) not null, "oos_items" jsonb not null, "chosen_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "partial_shipment_preference_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_partial_shipment_preference_deleted_at" ON "partial_shipment_preference" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cs_placed_order" cascade;`);

    this.addSql(`drop table if exists "guest_session" cascade;`);

    this.addSql(`drop table if exists "order_extension" cascade;`);

    this.addSql(`drop table if exists "order_state_history" cascade;`);

    this.addSql(`drop table if exists "partial_shipment_preference" cascade;`);
  }

}
