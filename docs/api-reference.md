# API Reference

Base URL: `http://localhost:9000` (dev) or `https://api.suprameds.in` (prod)

## Authentication

- **Admin routes** (`/admin/*`): Bearer token or session cookie
- **Store routes** (`/store/*`): Some public, some require `authenticate("customer", ["bearer", "session"])`
- **Webhooks** (`/webhooks/*`): HMAC signature verification

---

## Admin Endpoints (71)

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/analytics` | Dashboard KPIs |
| GET | `/admin/analytics/revenue` | Revenue trends |
| GET | `/admin/analytics/products` | Product performance |
| GET | `/admin/analytics/customers` | Customer analytics |
| GET | `/admin/analytics/wishlist` | Popular wishlisted products |

### Refunds

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/refunds` | List refunds (filters: status, order_id, raised_by) |
| POST | `/admin/refunds` | Raise refund `{ order_id, payment_id, reason, amount }` |
| GET | `/admin/refunds/:id` | Refund detail + COD bank details |
| POST | `/admin/refunds/:id/approve` | Approve (SSD-04: approver ≠ raiser) |
| POST | `/admin/refunds/:id/reject` | Reject `{ rejection_reason }` |
| POST | `/admin/refunds/:id/process` | Process via Razorpay/bank transfer |
| POST | `/admin/refunds/:id/cod-bank-details` | COD bank details `{ account_holder_name, bank_name, account_number, ifsc_code }` |

### Pharmacist

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/pharmacist/stats` | Dashboard stats (pending Rx, decisions today, H1 entries) |
| GET | `/admin/pharmacist/rx-queue` | Prescription review queue (H1 priority sorted) |

### Dispense

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/dispense/decisions` | Pharmacist decision history |
| POST | `/admin/dispense/decisions` | Record decision `{ prescription_line_id, decision, reason? }` |
| GET | `/admin/dispense/notes` | Pharmacist notes (filter: prescription_id) |
| POST | `/admin/dispense/notes` | Create note `{ prescription_id, note_text }` |
| GET | `/admin/dispense/pre-dispatch` | Pre-dispatch sign-off queue |
| POST | `/admin/dispense/pre-dispatch` | Sign off order |
| GET | `/admin/dispense/h1-register/export` | Export H1 register |

### Prescriptions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/prescriptions` | List all prescriptions |
| GET | `/admin/prescriptions/:id` | Prescription detail |
| POST | `/admin/prescriptions/:id` | Approve/reject prescription |
| GET | `/admin/prescriptions/:id/file-url` | Presigned S3 URL |

### Pharma Products

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/pharma/drug-products` | Drug master list |
| POST | `/admin/pharma/drug-products` | Create drug product |
| POST | `/admin/pharma/import` | Bulk product import |
| GET | `/admin/pharma/export` | Export inventory |

### Batches

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/pharma/batches` | List batches |
| GET | `/admin/pharma/batches/:id` | Batch detail |
| GET | `/admin/pharma/batches/low-stock` | Low stock alerts |
| POST | `/admin/pharma/batches/:id/recall` | Initiate batch recall |

### Purchase Orders

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/pharma/purchases` | List POs |
| POST | `/admin/pharma/purchases` | Create PO |
| GET | `/admin/pharma/purchases/:id` | PO detail |
| POST | `/admin/pharma/purchases/:id/lines` | Add line items |
| POST | `/admin/pharma/purchases/:id/receive` | GRN — receive goods |

### Warehouse

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/warehouse/inventory` | Batch inventory (filters: near_expiry, recalled, status) |
| GET | `/admin/warehouse/returns` | Returns awaiting inspection |
| POST | `/admin/warehouse/returns` | Submit inspection `{ inspection_lines: [{item_id, condition, accept}] }` |
| GET | `/admin/warehouse/zones` | List zones |
| POST | `/admin/warehouse/zones` | Create zone |
| GET | `/admin/warehouse/bins` | List bins (filter: zone_id) |
| POST | `/admin/warehouse/bins` | Create bin |
| GET | `/admin/warehouse/pick-lists` | All pick lists |
| GET | `/admin/warehouse/pick-lists/:orderId` | Order pick list |
| GET | `/admin/warehouse/pick-lists/print` | Printable HTML pick list |
| POST | `/admin/warehouse/pick-lists/:orderId/override` | Override allocation |
| POST | `/admin/warehouse/grn` | Create GRN |

### RBAC

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/rbac/roles` | List roles |
| GET | `/admin/rbac/users` | List users with roles |
| POST | `/admin/rbac/assign` | Assign role |
| POST | `/admin/rbac/revoke` | Revoke role |
| POST | `/admin/rbac/invite` | Invite user with role |
| POST | `/admin/rbac/credentials` | Create staff credential |
| GET | `/admin/rbac/me` | Current user profile |
| GET | `/admin/rbac/audit-log` | Access audit trail |
| POST | `/admin/rbac/seed` | Bootstrap roles (dev only) |

### Other Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/compliance/phi-logs` | PHI audit logs |
| POST | `/admin/compliance/override-requests` | Request compliance override |
| GET | `/admin/invoices` | List invoices |
| GET | `/admin/invoices/:orderId/pdf` | Download invoice PDF |
| GET | `/admin/loyalty` | Loyalty dashboard |
| GET | `/admin/shipments` | Shipment list |
| GET | `/admin/reports/sales-tax` | GST tax report |
| GET | `/admin/pincodes` | Serviceable pincodes |
| POST | `/admin/pincodes/import` | Bulk import pincodes (30MB limit) |
| POST | `/admin/mfa/setup` | TOTP enrollment |
| POST | `/admin/mfa/verify` | Verify TOTP |
| POST | `/admin/orders/cs-place` | CS-placed order |

---

## Store Endpoints (27)

### Products

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/products/search` | Full-text search |
| GET | `/store/products/pharma` | Drug metadata (schedule, composition) |
| GET | `/store/products/pharma/batch` | Batch info (MRP, expiry) |
| GET | `/store/products/interactions` | Drug interaction check |
| GET | `/store/products/substitutes` | Generic alternatives |

### Wishlist (authenticated)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/wishlist` | Customer's wishlist |
| POST | `/store/wishlist` | Add item `{ product_id, variant_id?, current_price? }` |
| DELETE | `/store/wishlist` | Remove item `{ product_id }` |
| POST | `/store/wishlist/:id/alert` | Toggle price alert `{ enabled, threshold_pct? }` |

### Prescriptions (authenticated)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/store/prescriptions` | Customer's prescriptions |
| POST | `/store/prescriptions` | Upload Rx (15MB limit) |
| POST | `/store/prescriptions/upload-file` | File upload to S3 |

### Cart & Checkout

| Method | Path | Description |
|--------|------|-------------|
| POST | `/store/carts/:id/prescription` | Attach Rx to cart |
| GET | `/store/delivery-estimate` | Pincode delivery estimate |
| POST | `/store/orders/cod-confirm` | Confirm COD order |
| POST | `/store/orders/guest` | Guest checkout session |
| POST | `/store/orders/:id/return-request` | Request return `{ items: [{line_item_id, quantity, reason}] }` |

### Other Store

| Method | Path | Description |
|--------|------|-------------|
| POST | `/store/otp/send` | Send OTP |
| POST | `/store/otp/verify` | Verify OTP |
| GET | `/store/pincodes/check` | Check delivery serviceability |
| GET | `/store/shipments` | Tracking info |
| GET | `/store/invoices/:orderId/pdf` | Customer invoice |
| POST | `/store/push/register` | Register FCM token |
| GET | `/store/reminders` | Refill reminders |
| POST | `/store/reminders` | Create reminder |

---

## Webhooks (5)

| Method | Path | Auth | Source |
|--------|------|------|--------|
| POST | `/webhooks/razorpay` | HMAC-SHA256 | Razorpay payments |
| POST | `/webhooks/stripe` | Stripe signature | Stripe payments |
| POST | `/webhooks/aftership` | HMAC | AfterShip tracking |
| POST | `/webhooks/msg91` | Token | MSG91 SMS delivery |
| POST | `/webhooks/whatsapp` | X-Hub-Signature-256 | Meta WhatsApp |
