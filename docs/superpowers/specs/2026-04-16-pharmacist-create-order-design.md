# Pharmacist Create Order (Storefront)

## Overview

A single-page order creation form where a pharmacist can look up a customer by phone, add products, attach a prescription if needed, set a shipping address, and place a COD order on behalf of that customer. Lives at `/account/pharmacist/create-order` in the storefront.

## Why

Pharmacists receive phone calls and walk-in requests. They need to create orders quickly without asking the customer to go through the storefront checkout themselves. The order must be registered under the customer's account with full details (address, items, prescription link).

## Scope

- Pharmacist selects customer by phone (or quick-registers new customer)
- Adds any products (OTC + Rx) via search
- Rx items require a prescription attachment
- Shipping address from customer's saved addresses or new entry
- Payment is COD only
- Order appears in the customer's order history

## Out of scope

- Online payment (Razorpay/Paytm) for pharmacist orders
- Multi-prescription consolidation
- Admin panel version (this is storefront only)
- Inventory/batch allocation (handled by existing post-order workflows)

---

## Backend

### Endpoint 1: Customer lookup/create

```
POST /store/pharmacist/customers/lookup
```

**Auth:** Pharmacist guard (customer with `metadata.role === "pharmacist"`)

**Request:**
```json
{
  "phone": "9876543210",
  "first_name": "Aarav",    // optional, required if creating
  "last_name": "Sharma"     // optional, required if creating
}
```

**Response (found):**
```json
{
  "found": true,
  "customer": {
    "id": "cus_01...",
    "first_name": "Aarav",
    "last_name": "Sharma",
    "phone": "+919876543210",
    "email": "aarav@example.com",
    "addresses": [...]
  }
}
```

**Response (not found, no name provided):**
```json
{
  "found": false,
  "customer": null
}
```

**Response (not found, name provided = auto-create):**
- Creates customer with `email: 9876543210@phone.suprameds.in`, random 16-char password
- Returns the new customer with `found: true`

**Validation:**
- Phone must be 10 digits (after stripping +91 prefix)
- If creating: first_name and last_name required

### Endpoint 2: Pharmacist create order

```
POST /store/pharmacist/orders/create
```

**Auth:** Pharmacist guard

**Request:**
```json
{
  "customer_id": "cus_01...",
  "items": [
    { "variant_id": "variant_01...", "quantity": 2 },
    { "variant_id": "variant_02...", "quantity": 1 }
  ],
  "shipping_address": {
    "first_name": "Aarav",
    "last_name": "Sharma",
    "address_1": "123 Main St",
    "city": "Hyderabad",
    "province": "Telangana",
    "postal_code": "500018",
    "country_code": "in",
    "phone": "9876543210"
  },
  "prescription_id": "rx_01...",
  "notes": "Phone order, customer called at 2pm"
}
```

**Flow:**
1. Validate customer exists
2. Check items: block Schedule X, narcotics, cold chain products
3. Check if any items are Rx (Schedule H/H1). If yes, `prescription_id` is required
4. Create cart for customer (set `customer_id` on cart)
5. Add line items
6. Set shipping address
7. Add shipping method (conditional standard shipping)
8. Create payment collection with COD (pp_system_default) session
9. Complete cart (creates Medusa order)
10. Link prescription to order if provided
11. Set cart metadata: `{ pharmacist_order: true, placed_by: pharmacist_customer_id, notes }`

**Response:**
```json
{
  "order_id": "order_01...",
  "display_id": 37,
  "total": 312.20,
  "message": "Order #37 created for Aarav Sharma"
}
```

**Error cases:**
- 404: Customer not found
- 400: Empty items array
- 400: Rx items without prescription_id
- 400: Schedule X or narcotic product in items
- 400: Invalid shipping address (missing required fields)
- 500: Cart completion failure (retried once)

### Existing endpoints reused (no changes)

| Endpoint | Purpose |
|----------|---------|
| `GET /store/pharmacist/products/search?q=` | Product search for adding items |
| `GET /store/prescriptions?customer_id=` | List customer's prescriptions |
| `POST /store/prescriptions` | Upload new prescription |

---

## Frontend

### New route

**File:** `apps/storefront/src/routes/$countryCode/account/_layout/pharmacist/create-order.tsx`

Route definition only. Delegates to the page component.

### New page

**File:** `apps/storefront/src/pages/account/pharmacist/create-order.tsx`

Single-page form with four sections, top to bottom:

#### Section 1: Customer Selector

- Phone input with +91 prefix
- "Search" button
- If found: show customer card (name, phone, email) with "Change" button
- If not found: show inline first_name + last_name fields, "Create & Select" button
- Once selected, section collapses to a summary card

#### Section 2: Product Search + Cart

- Search input using `usePharmacistProductSearch`
- Results dropdown: product name, composition, price, Rx/OTC badge, "Add" button
- Cart table below: product, qty (+/- controls), unit price, line total, remove
- Running subtotal at bottom

#### Section 3: Prescription (conditional)

- Only visible when cart has Rx items
- Yellow banner: "Prescription required for Rx medicines"
- If customer has existing prescriptions: show selectable cards (approved/pending_review)
- Upload button for new prescription
- Once selected, show green confirmation

#### Section 4: Shipping + Place Order

- If customer has saved addresses: radio cards to select
- "Use a different address" expands the AddressForm component
- Order summary: items count, subtotal, shipping (₹50 or free >₹300), total
- "Cash on Delivery" badge (non-changeable)
- "Place Order" button (disabled until customer + items + address are set, and prescription if Rx)
- On success: show green confirmation with order number + "Create Another Order" button

### State management

```
idle → customer_selected → items_added → ready → placing → done
```

All state is local (useState). No global store needed.

### New hooks (in `use-pharmacist.ts`)

```typescript
usePharmacistCustomerLookup()
// mutation: POST /store/pharmacist/customers/lookup

usePharmacistCreateOrder()
// mutation: POST /store/pharmacist/orders/create
```

### Nav update

Add "Create Order" link to the pharmacist account sidebar, below the existing "Rx Queue" link. Use a plus-circle icon.

---

## Compliance

- Schedule X and narcotic products are blocked at the API level
- Rx items (Schedule H/H1) require an approved or pending_review prescription
- Cold chain products are blocked (no cold chain logistics available)
- Order is tagged with `pharmacist_order: true` and `placed_by` in metadata for audit
- The pharmacist's customer ID is recorded so actions are traceable

## Testing

- Unit tests for the customer lookup endpoint (found, not found, create)
- Unit tests for the create order endpoint (OTC only, Rx with prescription, Rx without prescription blocked, Schedule X blocked)
- Frontend: component test for the customer selector (search, not found, create flow)

## Files to create/modify

| Action | File |
|--------|------|
| Create | `apps/backend/src/api/store/pharmacist/customers/lookup/route.ts` |
| Create | `apps/backend/src/api/store/pharmacist/orders/create/route.ts` |
| Create | `apps/storefront/src/routes/$countryCode/account/_layout/pharmacist/create-order.tsx` |
| Create | `apps/storefront/src/pages/account/pharmacist/create-order.tsx` |
| Modify | `apps/storefront/src/lib/hooks/use-pharmacist.ts` (add 2 hooks) |
| Modify | `apps/storefront/src/routes/$countryCode/account/_layout/pharmacist/` (add nav link) |
| Create | `apps/backend/src/__tests__/pharmacist-order.unit.spec.ts` |
