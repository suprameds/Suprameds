# Suprameds Import/Export Templates

## Product Import (`pharma-product-import-template.csv`)

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

### CSV Columns

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| **brand_name** | Yes | Product display name (also generates URL handle) | `Paracetamol 500mg Tablets` |
| **generic_name** | Yes | INN / generic compound name | `Paracetamol` |
| **composition** | Yes | Full active ingredients string | `Paracetamol 500mg` |
| **strength** | No | Strength per unit | `500mg`, `250mg/5ml` |
| **dosage_form** | Yes | `tablet`, `capsule`, `syrup`, `suspension`, `cream`, `drops`, `injection`, `inhaler`, `patch`, `other` | `tablet` |
| **pack_size** | No | Human-readable pack description | `10 tablets`, `100ml bottle` |
| **unit_type** | No | `tablet`, `strip`, `bottle`, `tube`, `box`, `sachet`, `vial`, `ampoule` | `strip` |
| **schedule** | Yes | Drug schedule: `OTC`, `H`, `H1`, `X` | `H` |
| **therapeutic_class** | No | Medical category | `Analgesic`, `Antibiotic` |
| **category** | No | Category handle (must exist in DB) | `pain-fever`, `diabetes-care` |
| **collection** | No | Collection title (must exist in DB) | `Pain Relief`, `Antidiabetic` |
| **selling_price_inr** | Yes | Your selling price in ₹ (whole rupees) | `15` |
| **mrp_inr** | No | MRP in ₹ (shown as strikethrough) | `35` |
| **gst_rate** | No | GST slab: `0`, `5`, `12`, `18` | `12` |
| **hsn_code** | No | HSN code for GST filing | `30049099` |
| **stock_qty** | No | Initial stock quantity (default: 50) | `100` |
| **manufacturer** | No | Manufacturer name | `Cipla Ltd` |
| **manufacturer_license** | No | Manufacturing license number | |
| **description** | No | Product description (auto-generated if blank) | |
| **indications** | No | What the drug treats | `Pain relief and fever` |
| **contraindications** | No | When NOT to use | `Liver disease` |
| **side_effects** | No | Known side effects | `Nausea, drowsiness` |
| **storage_instructions** | No | How to store | `Store below 30°C` |
| **dosage_instructions** | No | How to take | `1-2 tablets every 4-6 hours` |
| **is_chronic** | No | `true`/`false` — enables reorder reminders | `true` |
| **habit_forming** | No | `true`/`false` | `false` |
| **requires_refrigeration** | No | `true`/`false` — blocks listing if true | `false` |
| **is_narcotic** | No | `true`/`false` — blocks sale if true | `false` |
| **tags** | No | Semicolon-separated tag values | `rx_required;schedule_h;chronic` |

### Available Categories (pre-seeded)

| Handle | Name |
|--------|------|
| `pain-fever` | Pain & Fever |
| `cold-cough` | Cold & Cough |
| `allergy` | Allergy |
| `stomach-digestion` | Stomach & Digestion |
| `diabetes-care` | Diabetes Care |
| `heart-bp` | Heart & BP |
| `antibiotics-rx` | Antibiotics (Rx) |
| `dermatology` | Dermatology |
| `eye-ear` | Eye & Ear |
| `vitamins-supplements` | Vitamins & Supplements |
| `immunity` | Immunity |
| `ayurveda` | Ayurveda |
| `skin-care` | Skin Care |
| `oral-care` | Oral Care |
| `hair-care` | Hair Care |
| `monitoring-devices` | Monitoring Devices |
| `supports-braces` | Supports & Braces |
| `baby-care` | Baby Care |
| `women-health` | Women Health |

### Available Tags (pre-seeded)

`otc`, `rx_required`, `schedule_h`, `schedule_h1`, `chronic`, `pediatric`

### What the script creates per row

1. **Medusa Product** — title, handle, description, status=published
2. **Variant** — single variant with SKU, INR price
3. **Inventory Item** — linked to Main Warehouse with stock quantity
4. **Drug Product** — all pharma metadata (schedule, composition, GST, clinical info)
5. **Links** — product↔category, variant↔inventory

---

## Customer Import (`customer-import-template.csv`)

Upload via **Medusa Admin → Customers → Import**

| Column | Required | Example |
|--------|----------|---------|
| Email | Yes | `customer@example.com` |
| First Name | Yes | `Rahul` |
| Last Name | Yes | `Sharma` |
| Phone | No | `+919876543210` |
| Address 1 | No | `123 MG Road` |
| Address City | No | `Hyderabad` |
| Address Province | No | `Telangana` |
| Address Country Code | No | `in` |
| Address Postal Code | No | `500001` |

---

## Full Setup Workflow

```
1. npm run db:setup                # Schema + regions + shipping + sample catalog
2. npm run import:products         # Import your real product catalog from CSV
3. Upload customer CSV in Admin    # Optional
```
