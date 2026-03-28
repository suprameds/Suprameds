import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:000-reset-data")

export default async function resetData({ container }: { container: MedusaContainer }) {
  if (process.env.RESET_DATABASE !== "true") {
    logger.info("RESET_DATABASE not set — skipping reset")
    return
  }

  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  logger.warn("╔══════════════════════════════════════════════════╗")
  logger.warn("║  ⚠  DATABASE RESET — DELETING ALL DATA          ║")
  logger.warn("╚══════════════════════════════════════════════════╝")

  // 1. Drop the _seed_migrations tracking table so all seeds re-run
  await pgConnection.raw(`DROP TABLE IF EXISTS _seed_migrations`)
  logger.info("Dropped _seed_migrations table")

  // 2. Truncate all custom pharma module tables
  const pharmaTables = [
    // inventoryBatch module
    "batch_deduction", "batch_audit_log", "batch", "purchase_order_line", "purchase_order",
    // pharma module
    "drug_product",
    // prescription module
    "prescription_line", "prescription",
    // rbac module
    "mfa_secret", "invite_role", "staff_credential", "role_audit_log", "user_role", "permission", "role",
    // dispense module
    "pre_dispatch_sign_off", "pharmacist_note", "pharmacist_adjustment_log", "dispense_decision",
    // orders module
    "order_state_history", "order_extension", "partial_shipment_preference", "cs_placed_order", "guest_session",
    // payment module
    "cod_refund_details", "supply_memo", "payment_record", "refund",
    // shipment module
    "shipment_item", "shipment", "delivery_otp_log", "delivery_days_lookup",
    // warehouse module
    "returns_inspection", "pick_list_line", "grn_record", "warehouse_task", "warehouse_bin", "warehouse_zone", "warehouse", "supplier", "serviceable_pincode",
    // cod module
    "cod_order", "cod_customer_score",
    // compliance module
    "phi_audit_log", "pharmacy_license", "override_request", "h1_register_entry", "dpdp_consent",
    // crm module
    "chronic_reorder_pattern",
    // loyalty module
    "loyalty_transaction", "loyalty_account",
    // notification module
    "internal_notification", "notification_template",
    // wishlist module
    "wishlist_item",
  ]

  for (const table of pharmaTables) {
    try {
      await pgConnection.raw(`TRUNCATE TABLE "${table}" CASCADE`)
      logger.info(`  Truncated: ${table}`)
    } catch {
      // Table may not exist yet on fresh DB — that's fine
    }
  }

  // 3. Truncate Medusa core data tables (order matters for FK constraints — CASCADE handles it)
  const medusaTables = [
    // Links
    "product_variant_inventory_item",
    "product_category_product",
    "order_cart",
    "cart_payment_collection",
    "order_fulfillment",
    "order_promotion",
    // Orders & carts
    "order_line_item_tax_line",
    "order_line_item_adjustment",
    "order_line_item",
    "order_shipping_method_tax_line",
    "order_shipping_method_adjustment",
    "order_shipping_method",
    "order_address",
    "order_transaction",
    "order_change",
    "order_summary",
    "order",
    "cart_line_item_tax_line",
    "cart_line_item_adjustment",
    "cart_line_item",
    "cart_shipping_method_tax_line",
    "cart_shipping_method_adjustment",
    "cart_shipping_method",
    "cart_address",
    "cart",
    // Payment
    "payment_session",
    "payment",
    "payment_collection",
    "capture",
    "refund_reason",
    // Fulfillment
    "fulfillment_item",
    "fulfillment_label",
    "fulfillment",
    // Inventory
    "inventory_level",
    "reservation_item",
    "inventory_item",
    // Products
    "product_variant_price_set",
    "price",
    "price_set",
    "product_option_value",
    "product_variant",
    "product_option",
    "product_image",
    "product_tag",
    "product",
    // Collections
    "product_collection",
    // Categories (keep the structure, truncate product links)
    "product_category",
    // Customers
    "customer_address",
    "customer",
    // Notifications
    "notification",
    // Auth (admin users)
    "user",
    "auth_identity",
    "provider_identity",
  ]

  for (const table of medusaTables) {
    try {
      await pgConnection.raw(`TRUNCATE TABLE "${table}" CASCADE`)
      logger.info(`  Truncated: ${table}`)
    } catch {
      // Table may not exist or have different name — skip silently
    }
  }

  // 4. Clean up price preferences
  try {
    await pgConnection.raw(`TRUNCATE TABLE "price_preference" CASCADE`)
  } catch {}

  logger.warn("Database reset complete — all data deleted")
}
