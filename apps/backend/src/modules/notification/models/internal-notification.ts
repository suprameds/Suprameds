import { model } from "@medusajs/framework/utils"

/**
 * InternalNotification — in-app notifications for admin/pharmacist/warehouse staff.
 * Shows in admin dashboard bell icon via Redis pub/sub.
 */
const InternalNotification = model.define("internal_notification", {
  id: model.id().primaryKey(),

  user_id: model.text(),

  // If sent to all users of a role
  role_scope: model.text().nullable(),

  // Notification type
  type: model.enum([
    "rx_pending",
    "rx_sla_breach",
    "stock_low",
    "batch_expiry",
    "batch_recall",
    "low_stock",
    "out_of_stock",
    "cod_confirmation_due",
    "grievance_sla",
    "license_expiry",
    "compliance_failure",
    "dispatch_pending",
    "pre_dispatch_due",
    "mrp_conflict",
    "return_requested",
    "return_received",
    "return_inspected",
  ]),

  title: model.text(),
  body: model.text(),

  // Optional reference to the entity this notification is about
  reference_type: model.text().nullable(),
  reference_id: model.text().nullable(),

  read: model.boolean().default(false),
  read_at: model.dateTime().nullable(),
})

export default InternalNotification
