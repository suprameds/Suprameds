# Suprameds Backend — Comprehensive Test Plan

## Overview
End-to-end testing of all 15 backend modules, 97+ API routes, workflows, hooks, and the storefront order flow. Each feature group has 20-30 real-world scenarios covering happy paths, edge cases, compliance, and failure modes.

---

## 1. Authentication & RBAC (25 scenarios)

| # | Scenario | Method | Endpoint | Expected |
|---|----------|--------|----------|----------|
| 1 | Super admin login with correct credentials | POST | /auth/user/emailpass | 200 + JWT token |
| 2 | Login with wrong password | POST | /auth/user/emailpass | 401 Unauthorized |
| 3 | Login with non-existent email | POST | /auth/user/emailpass | 401 |
| 4 | List all RBAC roles | GET | /admin/rbac/roles | 200 + 25 roles array |
| 5 | Seed roles (idempotent re-run) | POST | /admin/rbac/seed | 200 success |
| 6 | Assign pharmacist role to user | POST | /admin/rbac/assign | 200 |
| 7 | Revoke role from user | POST | /admin/rbac/revoke | 200 |
| 8 | Check current user profile (/me) | GET | /admin/rbac/me | 200 + user with roles |
| 9 | List audit log entries | GET | /admin/rbac/audit-log | 200 + audit entries |
| 10 | Create staff credential (pharmacy license) | POST | /admin/rbac/credentials | 201 |
| 11 | Update staff credential | POST | /admin/rbac/credentials/:id | 200 |
| 12 | Verify staff credential (admin marks verified) | POST | /admin/rbac/credentials/:id | 200 + is_verified=true |
| 13 | Unverify staff credential | POST | /admin/rbac/credentials/:id | 200 + is_verified=false |
| 14 | Delete staff credential with audit trail | DELETE | /admin/rbac/credentials/:id | 200 |
| 15 | Access admin route without auth token | GET | /admin/rbac/roles | 401 |
| 16 | Access admin route with expired token | GET | /admin/rbac/roles | 401 |
| 17 | Pharmacist login | POST | /auth/user/emailpass | 200 |
| 18 | Warehouse manager login | POST | /auth/user/emailpass | 200 |
| 19 | Support agent login | POST | /auth/user/emailpass | 200 |
| 20 | Invite new admin user | POST | /admin/rbac/invite | 200 |
| 21 | List all admin users | GET | /admin/rbac/users | 200 + 10 users |
| 22 | Create user with duplicate email | POST | /admin/rbac/users | 409/error |
| 23 | SSD check: same user cannot approve own Rx | POST | compliance check | blocked |
| 24 | SSD check: GRN creator ≠ QC approver | POST | compliance check | blocked |
| 25 | Finance admin login | POST | /auth/user/emailpass | 200 |

---

## 2. Product Catalog & Pharma Data (25 scenarios)

| # | Scenario | Method | Endpoint | Expected |
|---|----------|--------|----------|----------|
| 1 | List all store products (paginated) | GET | /store/products | 200 + products array |
| 2 | Get single product by ID | GET | /store/products/:id | 200 + product detail |
| 3 | List pharma products with drug metadata | GET | /store/products/pharma | 200 + drug schedule, composition |
| 4 | Search products by name "Metformin" | GET | /store/products/search?q=metformin | results containing Metformin |
| 5 | Search products by composition "Paracetamol" | GET | /store/products/search?q=paracetamol | matching products |
| 6 | Search with no results | GET | /store/products/search?q=xyznonexist | empty results |
| 7 | Bulk fetch products by IDs | POST | /store/products/pharma/bulk | 200 + array |
| 8 | Get batch details for a product variant | GET | /store/products/pharma/batch | batch with expiry, MRP |
| 9 | Check drug interactions for 2 cart items | GET | /store/products/interactions | interaction warnings |
| 10 | Get drug substitutes for a product | GET | /store/products/substitutes | alternative medicines |
| 11 | Admin: list all drug products | GET | /admin/pharma/drug-products | 200 + full list |
| 12 | Admin: import products via CSV (idempotent skip) | POST | /admin/pharma/import | skipped count > 0 |
| 13 | Admin: export drug data | GET | /admin/pharma/export | CSV/JSON export |
| 14 | Verify OTC product has schedule="OTC" | GET | /store/products/pharma | schedule field correct |
| 15 | Verify H schedule product flagged correctly | GET | /store/products/pharma | schedule="H" |
| 16 | Verify H1 schedule product flagged correctly | GET | /store/products/pharma | schedule="H1" |
| 17 | Product has correct GST rate (5%) | GET | /store/products/pharma | gst_rate=5 |
| 18 | Product has correct HSN code | GET | /store/products/pharma | hsn_code present |
| 19 | Filter products by category | GET | /store/products?category_id=xxx | filtered results |
| 20 | Filter products by collection | GET | /store/products?collection_id=xxx | filtered results |
| 21 | Product MRP never below selling price | GET | /store/products/pharma | mrp >= selling_price |
| 22 | Products linked to correct categories | GET | /admin/products | category associations |
| 23 | Products linked to correct collections | GET | /admin/products | collection associations |
| 24 | Product inventory shows stock available | GET | /store/products | inventory_quantity > 0 |
| 25 | Full-text search with tsvector matches | GET | /store/products/search | FTS results |

---

## 3. Cart & Checkout (30 scenarios)

| # | Scenario | Method | Endpoint | Expected |
|---|----------|--------|----------|----------|
| 1 | Create a new cart | POST | /store/carts | 201 + cart_id |
| 2 | Add OTC product to cart | POST | /store/carts/:id/line-items | 200 |
| 3 | Add H schedule product to cart | POST | /store/carts/:id/line-items | 200 (needs Rx at checkout) |
| 4 | Add Schedule X product to cart → BLOCKED | POST | /store/carts/:id/line-items | 400 NDPS blocked |
| 5 | Update cart item quantity | POST | /store/carts/:id/line-items/:lid | 200 |
| 6 | Remove item from cart | DELETE | /store/carts/:id/line-items/:lid | 200 |
| 7 | Set shipping address (Indian pincode) | POST | /store/carts/:id | 200 |
| 8 | Set billing address | POST | /store/carts/:id | 200 |
| 9 | Add shipping method | POST | /store/carts/:id/shipping-methods | 200 |
| 10 | Attach prescription to cart | POST | /store/carts/:id/prescription | 200 + attached=true |
| 11 | Detach prescription from cart | POST | /store/carts/:id/prescription | 200 + attached=false |
| 12 | GET prescription status on cart | GET | /store/carts/:id/prescription | rx info + has_rx_items |
| 13 | Checkout OTC-only cart (no Rx needed) | POST | /store/carts/:id/complete | 200 order created |
| 14 | Checkout cart with H drug WITHOUT Rx → BLOCKED | POST | /store/carts/:id/complete | 400 Rx required |
| 15 | Checkout cart with H drug WITH approved Rx | POST | /store/carts/:id/complete | 200 order created |
| 16 | Checkout with pending_review Rx → allowed | POST | /store/carts/:id/complete | 200 |
| 17 | Checkout with rejected Rx → BLOCKED | POST | /store/carts/:id/prescription | 400 wrong status |
| 18 | Free shipping applied for order > ₹300 | POST | /store/carts/:id/shipping-methods | amount=0 |
| 19 | ₹50 shipping for order ≤ ₹300 | POST | /store/carts/:id/shipping-methods | amount=50 |
| 20 | Apply promo code on OTC cart | POST | /store/carts/:id/promotions | 200 discount applied |
| 21 | Apply promo code on Rx cart → BLOCKED | POST | /store/carts/:id/promotions | 400 no promos on Rx |
| 22 | Empty cart complete → error | POST | /store/carts/:id/complete | 400 |
| 23 | Cart with unserviceable pincode | POST | /store/carts/:id | warning or block |
| 24 | Multiple items in cart (mixed OTC + Rx) | POST | /store/carts/:id/line-items | 200 each |
| 25 | Cart total calculation correct (INR) | GET | /store/carts/:id | correct subtotal/total |
| 26 | GST calculation on cart items | GET | /store/carts/:id | tax lines present |
| 27 | Payment session initialization (Razorpay) | POST | /store/carts/:id/payment-sessions | razorpay session |
| 28 | Payment session initialization (COD) | POST | /store/carts/:id/payment-sessions | system session |
| 29 | Cart expiry / abandoned cart detection | GET | /store/carts/:id | stale cart handling |
| 30 | Guest cart creation (no auth) | POST | /store/carts | 201 no customer_id |

---

## 4. Prescription Management (25 scenarios)

| # | Scenario | Method | Endpoint | Expected |
|---|----------|--------|----------|----------|
| 1 | Customer uploads prescription file | POST | /store/prescriptions/upload-file | 200 + file_url |
| 2 | Create prescription record | POST | /store/prescriptions | 201 + prescription_id |
| 3 | Get prescription by ID | GET | /store/prescriptions/:id | 200 + details |
| 4 | Admin: list all prescriptions | GET | /admin/prescriptions | 200 + paginated list |
| 5 | Admin: get prescription detail | GET | /admin/prescriptions/:id | 200 |
| 6 | Admin: get prescription file URL | GET | /admin/prescriptions/:id/file-url | signed URL |
| 7 | Pharmacist: view Rx queue | GET | /admin/pharmacist/rx-queue | pending prescriptions |
| 8 | Pharmacist: approve prescription | POST | /admin/dispense/decisions | approved |
| 9 | Pharmacist: reject prescription with reason | POST | /admin/dispense/decisions | rejected + reason |
| 10 | Pharmacist: substitute drug in prescription | POST | /admin/dispense/decisions | substitution recorded |
| 11 | Pharmacist: add clinical note | POST | /admin/dispense/notes | 200 |
| 12 | Prescription status transitions: pending→approved | POST | workflow | state updated |
| 13 | Prescription status transitions: pending→rejected | POST | workflow | state updated |
| 14 | Expired prescription (>6 months) | auto job | purge-expired-prescriptions | archived |
| 15 | Prescription ownership check (customer A can't see B's) | GET | /store/prescriptions/:id | 403 |
| 16 | Attach approved prescription to cart | POST | /store/carts/:id/prescription | 200 |
| 17 | Attach rejected prescription to cart → blocked | POST | /store/carts/:id/prescription | 400 |
| 18 | Prescription with multiple drugs (line items) | GET | /admin/prescriptions/:id | multiple lines |
| 19 | Pre-dispatch sign-off by pharmacist | POST | /admin/dispense/pre-dispatch | 200 signed off |
| 20 | Pre-dispatch sign-off by non-pharmacist → blocked | POST | /admin/dispense/pre-dispatch | 403 |
| 21 | Pharmacist stats (workload) | GET | /admin/pharmacist/stats | stats object |
| 22 | Upload invalid file type → error | POST | /store/prescriptions/upload-file | 400 |
| 23 | Upload oversized file → error | POST | /store/prescriptions/upload-file | 400 |
| 24 | H1 drug register entry created on dispense | auto | h1-register-updated | entry logged |
| 25 | Export H1 register | GET | /admin/dispense/h1-register/export | CSV/PDF |

---

## 5. Inventory & Batches (25 scenarios)

| # | Scenario | Method | Endpoint | Expected |
|---|----------|--------|----------|----------|
| 1 | Admin: list all batches | GET | /admin/pharma/batches | 200 + batches |
| 2 | Admin: get single batch | GET | /admin/pharma/batches/:id | batch detail |
| 3 | Admin: create new batch | POST | /admin/pharma/batches | 201 |
| 4 | Admin: update batch quantity | PUT | /admin/pharma/batches/:id | 200 |
| 5 | Admin: check low stock alerts | GET | /admin/pharma/batches/low-stock | low stock list |
| 6 | Admin: recall batch | POST | /admin/pharma/batches/:id/recall | status=quarantined |
| 7 | Admin: import inventory via CSV | POST | /admin/inventory/import | 200 |
| 8 | FEFO allocation picks nearest-expiry first | auto | fefo-allocation workflow | nearest expiry picked |
| 9 | Batch with expired date not allocated | auto | fefo-allocation | skipped |
| 10 | Batch MRP ceiling enforced (never sell above MRP) | hook | fulfillment-fefo-mrp-check | MRP check passes |
| 11 | Batch deduction recorded on order | auto | order-placed subscriber | deduction created |
| 12 | Batch deduction reversed on cancellation | auto | order-canceled subscriber | deduction reversed |
| 13 | Purchase order creation | POST | /admin/pharma/purchases | 201 |
| 14 | Purchase order with line items | POST | /admin/pharma/purchases/:id/lines | 200 |
| 15 | GRN creation (goods received) | POST | /admin/pharma/purchases/:id/receive | 200 |
| 16 | GRN approval with QC | POST | /admin/warehouse/grn | approved |
| 17 | GRN SSD: creator ≠ approver | POST | /admin/warehouse/grn | SSD enforced |
| 18 | Near-expiry batch flagged (60-day MSL) | auto job | flag-near-expiry-batches | flagged |
| 19 | Batch with zero available_quantity | GET | /admin/pharma/batches | qty=0 |
| 20 | MRP conflict detection (batch vs catalog) | auto | batch-mrp-conflict subscriber | alert |
| 21 | Batch audit log entry on quantity change | auto | batch-audit-log | logged |
| 22 | Optimistic locking on concurrent deductions | auto | fefo-allocation | 3-retry logic |
| 23 | Admin: get purchase order detail | GET | /admin/pharma/purchases/:id | PO detail |
| 24 | Stock sync to storefront | auto job | sync-inventory-to-storefront | synced |
| 25 | Admin: batch data in product export | GET | /admin/pharma/export | includes batches |

---

## 6. Order Lifecycle (30 scenarios)

| # | Scenario | Method | Endpoint | Expected |
|---|----------|--------|----------|----------|
| 1 | Order placed after checkout | POST | /store/carts/:id/complete | order_id returned |
| 2 | Order confirmation notification sent | auto | order-placed subscriber | notification |
| 3 | Order payment captured (online) | auto | order-payment-captured | state→allocation_pending |
| 4 | COD order confirmation call | POST | /store/orders/cod-confirm | confirmed |
| 5 | COD order unconfirmed → auto-cancel (30 min) | auto job | cancel-unconfirmed-cod | cancelled |
| 6 | COD confirmation status check | GET | /store/orders/cod-confirm | status returned |
| 7 | Order state: placed → payment_captured → allocation_pending | auto | state machine | valid |
| 8 | Order state: allocation_pending → packed → dispatched | auto | state machine | valid |
| 9 | Order state: dispatched → delivered | auto | order-delivered subscriber | valid |
| 10 | Order cancellation | POST | /admin/orders/:id/cancel | cancelled + refund |
| 11 | Customer return request | POST | /store/orders/:id/return-request | 200 |
| 12 | Admin: list return requests | GET | /admin/orders/returns | 200 |
| 13 | Order edit (add item after placement) | POST | /admin/orders/:id/edit | 200 |
| 14 | Order edit confirmed | auto | order-edit-confirmed | items updated |
| 15 | CS-placed order (phone order) | POST | /admin/orders/cs-place | 200 |
| 16 | Guest order (no account) | POST | /store/orders/guest | 200 |
| 17 | Guest cart merge to registered customer | auto | merge-guest-cart workflow | merged |
| 18 | Order with GSTIN for B2B invoice | GET | /store/orders/gstin | GSTIN returned |
| 19 | Order state history tracking | auto | order-state-history | all transitions logged |
| 20 | Partial shipment preference | auto | partial-shipment-preference | respected |
| 21 | Order extension created (Rx/COD flags) | auto | order-placed | extension created |
| 22 | WhatsApp order update notification | auto | whatsapp-order-updates | sent |
| 23 | Payment failed notification | auto | payment-failed subscriber | customer notified |
| 24 | Abandoned cart reminder (3+ hours) | auto job | remind-abandoned-carts | reminder sent |
| 25 | Order invoice generation | GET | /admin/invoices | invoice created |
| 26 | Invoice PDF download (admin) | GET | /admin/invoices/:orderId/pdf | PDF returned |
| 27 | Invoice PDF download (customer) | GET | /store/invoices/:orderId/pdf | PDF returned |
| 28 | Admin: create/list invoices | GET/POST | /admin/invoices | 200 |
| 29 | Sales tax report for orders | GET | /admin/reports/sales-tax | GST breakdown |
| 30 | Order compliance flags set correctly | auto | order extension | is_rx, is_cod flags |

---

## 7. Payment & Refunds (25 scenarios)

| # | Scenario | Method | Endpoint | Expected |
|---|----------|--------|----------|----------|
| 1 | Razorpay payment session created | POST | /store/carts/:id/payment-sessions | razorpay session |
| 2 | Razorpay webhook: payment authorized | POST | /webhooks/razorpay | 200 |
| 3 | Razorpay webhook: payment captured | POST | /webhooks/razorpay | order state updated |
| 4 | Razorpay webhook: payment failed | POST | /webhooks/razorpay | customer notified |
| 5 | COD payment session created | POST | /store/carts/:id/payment-sessions | system session |
| 6 | COD order flow (no online capture) | POST | /store/carts/:id/complete | COD order placed |
| 7 | Raise refund request | POST | /admin/refunds | 201 |
| 8 | Get refund detail | GET | /admin/refunds/:id | refund info |
| 9 | Approve refund (SSD: different user) | POST | /admin/refunds/:id/approve | approved |
| 10 | Approve refund (same user) → SSD BLOCKED | POST | /admin/refunds/:id/approve | 403 SSD |
| 11 | Process refund to bank | POST | /admin/refunds/:id/process | processed |
| 12 | Reject refund with reason | POST | /admin/refunds/:id/reject | rejected |
| 13 | COD refund: set bank details | POST | /admin/refunds/:id/cod-bank-details | 200 |
| 14 | Refund raised notification | auto | refund-raised subscriber | admin notified |
| 15 | Refund approved notification | auto | refund-approved subscriber | state updated |
| 16 | Refund processed notification | auto | refund-processed subscriber | customer notified |
| 17 | Razorpay webhook: refund completed | POST | /webhooks/razorpay | 200 |
| 18 | Payment record created on auth | auto | payment-record | recorded |
| 19 | Supply memo for non-saleable returns | auto | supply-memo | debit note created |
| 20 | Stripe webhook handling | POST | /webhooks/stripe | 200 |
| 21 | Admin: list all refunds | GET | /admin/refunds | paginated list |
| 22 | Double refund prevention | POST | /admin/refunds/:id/process | already processed error |
| 23 | Refund amount validation (can't exceed order) | POST | /admin/refunds | validation error |
| 24 | COD customer score update after delivery | auto | cod-customer-score | score adjusted |
| 25 | Payment record audit trail | auto | payment-record | auth→capture logged |

---

## 8. Warehouse Operations (25 scenarios)

| # | Scenario | Method | Endpoint | Expected |
|---|----------|--------|----------|----------|
| 1 | List warehouse zones | GET | /admin/warehouse/zones | zones list |
| 2 | Create warehouse zone | POST | /admin/warehouse/zones | 201 |
| 3 | List warehouse bins | GET | /admin/warehouse/bins | bins list |
| 4 | Create warehouse bin | POST | /admin/warehouse/bins | 201 |
| 5 | Generate pick list for order | GET | /admin/warehouse/pick-lists/:orderId | pick list |
| 6 | Print pick lists (batch) | POST | /admin/warehouse/pick-lists/print | 200 |
| 7 | Override pick list (force items) | POST | /admin/warehouse/pick-lists/:orderId/override | 200 |
| 8 | GRN creation | POST | /admin/warehouse/grn | 201 |
| 9 | GRN QC approval | POST | /admin/warehouse/grn | approved |
| 10 | GRN rejection | POST | /admin/warehouse/grn | rejected |
| 11 | Returns inspection | POST | /admin/warehouse/returns | inspection result |
| 12 | Returns: accept saleable item | POST | /admin/warehouse/returns | restocked |
| 13 | Returns: reject damaged item | POST | /admin/warehouse/returns | supply memo |
| 14 | Check real-time inventory levels | GET | /admin/warehouse/inventory | levels |
| 15 | Pincode serviceability check | POST | /store/pincodes/check | serviceable/not |
| 16 | Admin: list pincodes | GET | /admin/pincodes | paginated list |
| 17 | Admin: create pincode | POST | /admin/pincodes | 201 |
| 18 | Admin: import pincodes bulk | POST | /admin/pincodes/import | 200 |
| 19 | Delivery estimate by pincode | GET | /store/delivery-estimate | days estimate |
| 20 | Unserviceable pincode check | POST | /store/pincodes/check | not serviceable |
| 21 | Warehouse task creation (pick) | auto | warehouse-task | task created |
| 22 | Warehouse task completion | auto | warehouse-task | completed |
| 23 | Cold chain zone check | auto | warehouse-zone | temp zone validated |
| 24 | Supplier master CRUD | auto | supplier model | CRUD operations |
| 25 | Delivery days lookup refresh | auto job | update-delivery-days | updated |

---

## 9. Customer Features (25 scenarios)

| # | Scenario | Method | Endpoint | Expected |
|---|----------|--------|----------|----------|
| 1 | Add product to wishlist | POST | /store/wishlist | 201 |
| 2 | List wishlist items | GET | /store/wishlist | items array |
| 3 | Remove from wishlist | DELETE | /store/wishlist/:id | deleted |
| 4 | Enable price-drop alert | POST | /store/wishlist/:id/alert | enabled=true |
| 5 | Disable price-drop alert | POST | /store/wishlist/:id/alert | enabled=false |
| 6 | Set alert threshold (10%) | POST | /store/wishlist/:id/alert | threshold=10 |
| 7 | Invalid threshold (>100) → error | POST | /store/wishlist/:id/alert | 400 |
| 8 | Wishlist ownership check | GET | /store/wishlist | only own items |
| 9 | Get loyalty account | GET | /store/loyalty/account | balance + tier |
| 10 | Loyalty points earned on OTC order | auto | award-points workflow | points added |
| 11 | Loyalty points NOT earned on Rx order | auto | award-points workflow | no points |
| 12 | Loyalty tier upgrade (silver→gold) | auto | tier computation | upgraded |
| 13 | Admin: manage loyalty account | GET | /admin/loyalty/customer/:id | account detail |
| 14 | Create chronic refill reminder | POST | /store/reminders | 201 |
| 15 | List reminders | GET | /store/reminders | reminders array |
| 16 | Update reminder frequency | POST | /store/reminders/:id | updated |
| 17 | Toggle reminder active/inactive | POST | /store/reminders/:id | toggled |
| 18 | Delete reminder | DELETE | /store/reminders/:id | deleted |
| 19 | Reminder ownership check | GET | /store/reminders | only own |
| 20 | Chronic reorder pattern detection | auto job | identify-chronic-reorders | patterns found |
| 21 | Refill reminder SMS sent | auto job | send-chronic-refill-reminders | sent |
| 22 | Wishlist price alert fired on price drop | auto job | check-wishlist-price-alerts | alert sent |
| 23 | Customer 360 analytics | GET | /admin/analytics/customers | customer profile |
| 24 | Push notification register | POST | /store/push/register | 200 |
| 25 | Push notification unregister | POST | /store/push/unregister | 200 |

---

## 10. Shipping & Fulfillment (20 scenarios)

| # | Scenario | Method | Endpoint | Expected |
|---|----------|--------|----------|----------|
| 1 | Create shipment for order | auto | create-shipment workflow | shipment created |
| 2 | List customer shipments | GET | /store/shipments | shipments array |
| 3 | Admin: list all shipments | GET | /admin/shipments | paginated list |
| 4 | Admin: get shipment detail | GET | /admin/shipments/:id | tracking info |
| 5 | OTP generated for Rx delivery | auto | shipment creation | OTP set |
| 6 | OTP verification on delivery | auto | verifyOtp | verified |
| 7 | Wrong OTP → rejection | auto | verifyOtp | rejected |
| 8 | AfterShip webhook: in_transit | POST | /webhooks/aftership | status updated |
| 9 | AfterShip webhook: delivered | POST | /webhooks/aftership | order completed |
| 10 | AfterShip webhook: NDR (non-delivery) | POST | /webhooks/aftership | NDR handled |
| 11 | AfterShip webhook: RTO | POST | /webhooks/aftership | RTO initiated |
| 12 | AfterShip sync job | auto job | sync-aftership-status | statuses synced |
| 13 | Conditional shipping: free for >₹300 | auto | fulfillment | ₹0 |
| 14 | Conditional shipping: ₹50 for ≤₹300 | auto | fulfillment | ₹50 |
| 15 | Dispatch notification sent | auto | order-dispatched subscriber | notified |
| 16 | Delivery confirmation | auto | order-delivered subscriber | confirmed |
| 17 | Pre-dispatch pharmacist sign-off required | auto | pre-dispatch-check workflow | enforced |
| 18 | Shipment items linked to batches | auto | shipment-item | batch tracking |
| 19 | Delivery days lookup | GET | /store/delivery-estimate | estimate |
| 20 | WhatsApp dispatch update | auto | whatsapp-order-updates | sent |

---

## 11. Compliance & Regulatory (20 scenarios)

| # | Scenario | Method | Endpoint | Expected |
|---|----------|--------|----------|----------|
| 1 | PHI audit log created on Rx access | auto | phi-audit-log | logged |
| 2 | Admin: view PHI logs | GET | /admin/compliance/phi-logs | 200 |
| 3 | Override request creation | POST | /admin/compliance/override-requests | 201 |
| 4 | Override request approval | POST | /admin/compliance/override-requests | approved |
| 5 | Schedule X product blocked at add-to-cart | hook | schedule-x-block | 400 |
| 6 | H drug requires prescription at checkout | hook | validate-cart-rx | 400 without Rx |
| 7 | H1 drug requires prescription at checkout | hook | validate-cart-rx | 400 without Rx |
| 8 | No promos on Rx drugs | hook | completeCart validate | blocked |
| 9 | H1 register entry on dispense | auto | h1-register-updated | entry created |
| 10 | H1 register monthly export | auto job | generate-h1-report | report generated |
| 11 | DPDP consent tracking | auto | dpdp-consent model | recorded |
| 12 | Pharmacy license record | auto | pharmacy-license model | stored |
| 13 | MRP ceiling enforcement (never sell above MRP) | hook | fulfillment-fefo-mrp-check | enforced |
| 14 | Drug interaction warning at add-to-cart | hook | schedule-x-block | warning issued |
| 15 | Cold chain product flagged | hook | schedule-x-block | cold chain flag |
| 16 | PHI log purge (7-year retention) | auto job | clear-phi-audit-logs | archived |
| 17 | SSD enforcement on refund approval | workflow | approve-refund | SSD checked |
| 18 | SSD enforcement on GRN approval | workflow | approve-grn | SSD checked |
| 19 | Sales tax (GST) report generation | auto job | generate-sales-tax-report | report |
| 20 | DLT template verification | auto job | verify-dlt-templates | verified |

---

## 12. Analytics & Admin Dashboard (20 scenarios)

| # | Scenario | Method | Endpoint | Expected |
|---|----------|--------|----------|----------|
| 1 | KPI dashboard metrics | GET | /admin/analytics | revenue, orders, etc |
| 2 | Revenue analytics by period | GET | /admin/analytics/revenue | revenue data |
| 3 | Customer analytics | GET | /admin/analytics/customers | segmentation |
| 4 | Product performance | GET | /admin/analytics/products | top sellers |
| 5 | Wishlist conversion funnel | GET | /admin/analytics/wishlist | funnel data |
| 6 | Customer import (bulk) | POST | /admin/customers/import | 200 |
| 7 | Price import (bulk) | POST | /admin/prices/import | 200 |
| 8 | Invoice management | GET | /admin/invoices | invoice list |
| 9 | Loyalty program dashboard | GET | /admin/loyalty | program stats |
| 10 | Pharmacist workload stats | GET | /admin/pharmacist/stats | stats |
| 11 | Admin: product analytics | GET | /admin/analytics/products | analytics |
| 12 | Admin: revenue breakdown | GET | /admin/analytics/revenue | breakdown |
| 13 | Sales tax report | GET | /admin/reports/sales-tax | GST report |
| 14 | Invoice PDF generation | GET | /admin/invoices/:id/pdf | PDF |
| 15 | Admin: MFA setup | POST | /admin/mfa/setup | TOTP QR |
| 16 | Admin: MFA verify | POST | /admin/mfa/verify | verified |
| 17 | OTP send (customer) | POST | /store/otp/send | 200 |
| 18 | OTP verify (customer) | POST | /store/otp/verify | 200 |
| 19 | MSG91 webhook delivery receipt | POST | /webhooks/msg91 | 200 |
| 20 | WhatsApp webhook callback | POST | /webhooks/whatsapp | 200 |

---

## Execution Strategy

### Phase 1: API Smoke Tests (parallel agents)
Run 5 agents simultaneously testing:
- Agent 1: Auth + RBAC (sections 1)
- Agent 2: Products + Search (section 2)
- Agent 3: Cart + Checkout (section 3)
- Agent 4: Inventory + Warehouse (sections 5, 8)
- Agent 5: Customer features (section 9)

### Phase 2: Workflow Tests (sequential)
Test prescription, fulfillment, and payment workflows that depend on Phase 1 data.

### Phase 3: GUI Verification (Chrome DevTools)
- Admin dashboard loads
- Storefront product listing
- Cart functionality
- Checkout flow

### Phase 4: Full Order Flow (end-to-end)
Complete order: browse → add to cart → checkout → payment → order confirmation
