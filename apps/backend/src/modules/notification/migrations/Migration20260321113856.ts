import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260321113856 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "internal_notification" drop constraint if exists "internal_notification_type_check";`);

    this.addSql(`alter table if exists "internal_notification" add constraint "internal_notification_type_check" check("type" in ('rx_pending', 'rx_sla_breach', 'stock_low', 'batch_expiry', 'cod_confirmation_due', 'grievance_sla', 'license_expiry', 'compliance_failure', 'dispatch_pending', 'pre_dispatch_due', 'mrp_conflict'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "internal_notification" drop constraint if exists "internal_notification_type_check";`);

    this.addSql(`alter table if exists "internal_notification" add constraint "internal_notification_type_check" check("type" in ('rx_pending', 'rx_sla_breach', 'stock_low', 'batch_expiry', 'cod_confirmation_due', 'grievance_sla', 'license_expiry', 'compliance_failure', 'dispatch_pending', 'pre_dispatch_due'));`);
  }

}
