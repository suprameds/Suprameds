# Suprameds Import/Export Templates

## 1. Product Import (`pharma-product-import-template.csv`)

**Single CSV, single command** — creates both the Medusa product AND pharma drug metadata.

### How to use

```bash
cd apps/backend

# Import from the template file (default)
npm run import:products

# Import from a custom file
npm run import:products -- --file=./my-catalog.csv

# Update existing products (matched by handle) instead of skipping
npm run import:products -- --file=./my-catalog.csv --update
```

**Or via API:** `POST /admin/pharma/import` with `{ rows: [...] }`

### CSV Columns

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| **brand_name** | Yes | Product display name | `Paracetamol 500mg Tablets` |
| **generic_name** | Yes | INN / generic compound name | `Paracetamol` |
| **composition** | Yes | Full active ingredients | `Paracetamol 500mg` |
| **dosage_form** | Yes | `tablet`, `capsule`, `syrup`, etc. | `tablet` |
| **schedule** | Yes | `OTC`, `H`, `H1`, `X` | `H` |
| **selling_price_inr** | Yes | Selling price in whole ₹ | `15` |
| strength | No | Strength per unit | `500mg` |
| pack_size | No | Pack description | `10 tablets` |
| mrp_inr | No | MRP in ₹ (strikethrough) | `35` |
| gst_rate | No | `0`, `5`, `12`, `18` | `12` |
| stock_qty | No | Initial stock (default: 50) | `100` |
| therapeutic_class | No | Medical category | `Analgesic` |
| category | No | Category handle (must exist) | `pain-fever` |
| indications | No | What the drug treats | `Pain, fever` |
| side_effects | No | Known side effects | `Nausea` |
| batch_lot_number | No | Batch lot number | `LOT-2026-001` |
| batch_expiry_date | No | Batch expiry (YYYY-MM-DD) | `2028-03-15` |
| *(35 columns total — see template CSV for all)* |

### What the script creates per row

1. **Medusa Product** — title, handle, description, status=published
2. **Variant** — single variant with SKU, INR price
3. **Inventory Item** — linked to Main Warehouse with stock quantity
4. **Drug Product** — all pharma metadata (schedule, composition, GST, clinical info)
5. **Inventory Batch** — lot/expiry tracking if batch data provided
6. **Links** — product→category, variant→inventory

---

## 2. Customer Import (`customer-import-template.csv`)

**API:** `POST /admin/customers/import` with `{ rows: [...] }`

### CSV Columns

| Column | Required | Example |
|--------|----------|---------|
| **Email** | Yes | `customer@example.com` |
| **First Name** | Yes | `Rahul` |
| **Last Name** | Yes | `Sharma` |
| Phone | No | `+919876543210` |
| Has Account | No | `true` |
| Address 1 | No | `123 MG Road` |
| Address City | No | `Hyderabad` |
| Address Province | No | `Telangana` |
| Address Country Code | No | `in` |
| Address Postal Code | No | `500001` |
| Address Phone | No | `+919876543210` |

### What it creates per row

1. **Customer account** — email, name, phone
2. **Address** — if address fields provided (address_1 + country_code required)
3. **Duplicate detection** — skips if email already exists

---

## 3. Inventory Stock Update (`inventory-update-template.csv`)

**API:** `POST /admin/inventory/import` with `{ rows: [...], mode: "add" | "set" }`

- `mode: "add"` (default) — adds quantity to existing stock
- `mode: "set"` — sets stock to exact quantity

### CSV Columns

| Column | Required | Example |
|--------|----------|---------|
| **SKU** | Yes | `METCYN-500-SR` |
| **Stock Quantity** | Yes | `100` |
| Batch Lot Number | No | `LOT-2026-001` |
| Batch Expiry Date | No | `2028-03-15` |
| Batch Manufactured On | No | `2026-01-10` |
| Batch MRP INR | No | `180` |
| Batch Purchase Price INR | No | `45` |
| Batch Supplier | No | `Supracyn Pharmaceuticals` |
| Batch GRN Number | No | `GRN-2026-001` |

### What it does per row

1. **Matches by SKU** — finds the variant and its inventory item
2. **Updates stock level** — adds or sets quantity at the main warehouse
3. **Creates batch** — if lot number + expiry provided (for FEFO tracking)

---

## 4. Price Update (`price-update-template.csv`)

**API:** `POST /admin/prices/import` with `{ rows: [...] }`

### CSV Columns

| Column | Required | Example |
|--------|----------|---------|
| **SKU** | Yes | `METCYN-500-SR` |
| Selling Price INR | No | `72` |
| MRP INR | No | `180` |
| GST Rate | No | `12` |

### What it does per row

1. **Matches by SKU** — finds the variant and drug_product
2. **Updates selling price** — changes the INR variant price
3. **Updates MRP** — changes drug_product.mrp_paise (stored as paise)
4. **Updates GST** — changes drug_product.gst_rate

---

## 5. Pincode Import (via Admin UI)

**API:** `POST /admin/pincodes/import` with `{ rows: [...], mode: "replace" | "append", chunk_index, total_chunks }`

---

## Full Setup Workflow

```bash
1. npm run db:setup                # Schema + regions + shipping + seed data
2. npm run import:products         # Import product catalog from CSV
3. POST /admin/customers/import    # Import customers (via Admin UI or API)
4. POST /admin/inventory/import    # Stock replenishment
5. POST /admin/prices/import       # Bulk price updates
```

## API Response Format (all imports)

```json
{
  "summary": { "total": 100, "created": 95, "skipped": 3, "errors": 2 },
  "results": [
    { "email": "...", "status": "created" },
    { "sku": "...", "status": "skipped", "message": "Already exists" },
    { "sku": "...", "status": "error", "message": "Invalid data" }
  ]
}
```
