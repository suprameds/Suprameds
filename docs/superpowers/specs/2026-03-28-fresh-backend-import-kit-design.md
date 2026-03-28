# Fresh Backend Import Kit

## Context
Medusa Cloud DB needs to be flushed and rebuilt fresh. Since Medusa Cloud doesn't provide SSH access, all data setup must happen through either seed scripts (run on deploy) or CSV import via admin API endpoints. The goal is a clean backend with just the mandatory infra + editable CSV data for products, inventory, customers, and pincodes.

## What exists today

### Seed scripts (run automatically on deploy via cloud-start.mjs)
- `001-infra-seed.ts` — India region, INR, GST 5%, warehouse, shipping
- `002-rbac-seed.ts` — 25 roles, 65 permissions, 10 admin users
- `003-fts-index.ts` — PostgreSQL full-text search
- `004-product-catalog.ts` — 52 hardcoded products (SKIP via `SKIP_PRODUCT_SEED=true`)

### Admin import endpoints
- `POST /admin/pharma/import` — products + drug metadata (matches `category` column to existing category handles)
- `POST /admin/inventory/import` — stock levels + pharma batches
- `POST /admin/customers/import` — customers with addresses
- `POST /admin/pincodes/import` — delivery serviceability pincodes

### Current Cloud data
**5 Categories** (hierarchical): Medicines, Wellness, Personal Care, Devices, Mother & Baby
**12 Collections** (flat): Antidiabetic, Cardiology, Pain Relief, Vitamins, Dermatology, Gastro, Antibiotics, Respiratory, Cardiac, Vitamins & Wellness, Antihypertensive, Pain & Fever

### Storefront category icons
`home.tsx` has a `CATEGORY_ICONS` map that only matches dosage forms (tablets/capsules/syrups). All therapeutic categories get a generic "+" icon.

## Plan

### 1. Update `001-infra-seed.ts` — add category + collection creation

Create the 5 parent categories with therapeutic subcategories under "Medicines":

```
Medicines (parent)
  ├── Antibiotics
  ├── Diabetic
  ├── Hypertension
  ├── Cardiac Care
  ├── Cholesterol
  ├── Gastroenterology
  ├── General Medicines
  ├── Gynecology
  ├── Nephrology
  ├── Neurology
  ├── Respiratory
  ├── Dermatology
  ├── Pain & Fever
  ├── Vitamins & Supplements
Wellness (parent — no subcategories for now)
Personal Care (parent — no subcategories for now)
Devices (parent — no subcategories for now)
Mother & Baby (parent — no subcategories for now)
```

Also create the 12 collections that match the current Cloud state.

Use `createProductCategoriesWorkflow` and `createCollectionsWorkflow` from `@medusajs/medusa/core-flows`. Idempotent — check by handle before creating.

### 2. Update `home.tsx` — therapeutic category icons

Replace the dosage-form-based `CATEGORY_ICONS` with a map keyed by category handle:

| Handle | Icon concept |
|--------|-------------|
| antibiotics | pill + shield |
| diabetic | blood sugar drop |
| hypertension | heart + pulse |
| cardiac-care | heart |
| cholesterol | artery |
| gastroenterology | stomach |
| general-medicines | medicine bottle |
| gynecology | female symbol |
| nephrology | kidney |
| neurology | brain |
| respiratory | lungs |
| dermatology | skin/hand |
| pain-fever | thermometer |
| vitamins-supplements | vitamin capsule |
| mother-baby | mother + child |
| wellness | leaf/zen |
| personal-care | person |
| devices | stethoscope |

All as inline SVGs (no icon library dependency), matching existing code style.

### 3. Generate CSV data files in `apps/backend/data/`

**`products.csv`** — ~80 real Indian generic medicines
- Columns match `pharma-product-import-template.csv` format
- `category` column uses subcategory names (e.g., "Antibiotics", "Diabetic") which the import route slugifies and looks up
- All GST 5%, real pricing, accurate pharma metadata
- Covers all 14 therapeutic subcategories under Medicines

**`inventory.csv`** — stock levels + batches for all SKUs
- Columns match `inventory-update-template.csv` format
- 100 units stocked per SKU
- 2 batches per SKU (lot A: 18mo expiry, lot B: 12mo expiry)
- MRP and cost price per batch

**`customers.csv`** — 5 test customers
- Columns match `customer-import-template.csv` format
- Indian addresses across different cities
- For testing checkout/order flow

**`pincodes.csv`** — 50 top Indian metro pincodes
- For delivery serviceability testing

### 4. Create `apps/backend/src/scripts/import-fresh-data.ts`

A Medusa exec script that:
1. Reads all 4 CSV files from `apps/backend/data/`
2. Parses them
3. Calls the import logic directly (same code as the admin routes but via container, not HTTP)
4. Runs via `npx medusa exec ./src/scripts/import-fresh-data.ts`

### 5. Add npm script

```json
"db:import": "medusa exec ./src/scripts/import-fresh-data.ts"
```

## Fresh instance setup playbook

```bash
# On Medusa Cloud — set these env vars:
SKIP_PRODUCT_SEED=true

# Deploy triggers cloud-start.mjs automatically:
# 1. medusa db:migrate → creates all tables
# 2. run-migrations.ts → runs 001 (infra + categories), 002 (RBAC + users), 003 (FTS)
# 3. medusa start → boot

# Then import data (run once after deploy):
npx medusa exec ./src/scripts/import-fresh-data.ts
# → imports products.csv, inventory.csv, customers.csv, pincodes.csv
```

## Files to modify/create

| File | Action |
|------|--------|
| `src/migration-scripts/001-infra-seed.ts` | Add category + collection creation step |
| `apps/storefront/src/pages/home.tsx` | Replace `CATEGORY_ICONS` with therapeutic category icons |
| `data/products.csv` | New — ~80 medicines |
| `data/inventory.csv` | New — stock + batches |
| `data/customers.csv` | New — 5 test customers |
| `data/pincodes.csv` | New — 50 metro pincodes |
| `src/scripts/import-fresh-data.ts` | New — CSV import script |
| `package.json` | Add `db:import` script |

## Verification
1. Type-check passes (`npx tsc --noEmit`)
2. `001-infra-seed.ts` creates categories + collections when run on fresh DB
3. CSV files parse correctly and match template column formats
4. Import script runs without errors on fresh DB
5. Home page shows correct icons per category
6. Products appear in storefront with correct categories
7. Inventory exists — can add to cart and complete checkout
