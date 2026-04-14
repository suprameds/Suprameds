# Product Import Pipeline — Stock Report to Medusa

**Date:** 2026-04-09
**Status:** Design approved, pending implementation

## Problem

Suprameds has 1,151 line items in their billing software (Supracyn Pharma stock report PDF) that need to be imported into the Medusa.js v2 ecommerce backend. The stock report only has 5 columns (Item Name, Sale Price, Purchase Price, Stock Quantity, Stock Value) but the Medusa import template requires 36 columns of pharma-specific data.

## Approach: Three-Phase AI-Enriched Import

### Phase 1: Extract & Deduplicate

**Input:** `StockSummaryReport_08_04_26.pdf` (1,151 line items)

**Steps:**
1. Parse PDF into structured data: `[item_name, sale_price, purchase_price, stock_qty, stock_value]`
2. Filter out junk entries: items with ₹0 sale price AND 0 stock AND no meaningful name (e.g. "AT", "PI", "mul", "XY", "su")
3. Deduplicate:
   - Strip suffixes: `(EXTRA)`, `(EXTRAS)`, `(EXTRASS)`, `(EXTRASSS)`, `(EXTRASSSS)`
   - Normalize: collapse multiple entries like `ATORCYN-10`, `ATORCYN-10 EXTRA`, `ATORCYN-10MG`, `ATORCYN 10` into one product
   - Keep the HIGHEST MRP across duplicates (pharma compliance: never sell above MRP)
   - Sum stock quantities across duplicates
4. Extract strength from item name (e.g. "AMLOSKY 10" → strength: "10mg")
5. Extract dosage form hints (e.g. "SYP" → Syrup, "DROPS" → Drops, "CREAM" → Cream, "GEL" → Gel, "SUS" → Suspension, default: Tablet)

**Output:** ~400-500 deduplicated product records with: `[brand_name, strength, dosage_form, mrp, purchase_price, stock_qty]`

### Phase 2: AI Enrichment

**Data sources:**
- Brand name patterns (CYN/DAX suffixes = Supracyn Pharma brands)
- suprameds.in product listings (our own site)
- 1mg.com, pharmeasy.com drug databases (generic name lookups)
- Known pharma salt-brand mappings

**Fields to enrich per product:**
| Field | Method |
|-------|--------|
| `generic_name` | AI mapping from brand name patterns + web lookup |
| `composition` | Full salt composition with strength |
| `schedule` | H/H1/OTC based on drug class (conservative: default H for Rx drugs) |
| `therapeutic_class` | From drug composition (e.g. Atorvastatin → Statin) |
| `category` | Map to Medusa categories: diabetic, hypertension, cholesterol, etc. |
| `collection` | Map to Medusa collections |
| `dosage_form` | From item name hints or drug knowledge |
| `pack_size` | Standard pack sizes per drug type (default: "10 tablets") |
| `unit_type` | strip/bottle/tube based on dosage form |
| `manufacturer` | "Supracyn Pharma" for CYN/DAX brands, lookup for third-party |
| `gst_rate` | 5 (standard pharma rate for most formulations) |
| `hsn_code` | 30049099 (standard pharma HSN) |
| `description` | Generated pharma description |
| `indications` | Standard indications for the drug |
| `storage_instructions` | "Store below 30°C in a dry place" (default) |
| `is_chronic` | Based on therapeutic class |
| `tags` | rx_required;schedule_h (or otc for OTC items) |

**Fields left empty (need manual input or batch data):**
- `contraindications`, `side_effects`, `dosage_instructions` (can be enriched later)
- `batch_lot_number`, `batch_expiry_date`, `batch_manufactured_on` (not in stock report)
- `batch_supplier`, `batch_grn_number` (not in stock report)
- `manufacturer_license` (needs verification)

**Output:** Full 36-column CSV ready for review

### Phase 3: Review & Import

1. Generate `data/stock-import-review.csv` with all enriched data
2. User reviews in Excel/Google Sheets — corrects AI errors, fills manufacturer for third-party products
3. Run existing `import-products.ts` script: `npx medusa exec ./src/scripts/import-products.ts -- --file=./data/stock-import-review.csv`
4. Products created in Medusa with prices, categories, collections
5. Stock quantities set via inventory management

## Data Quality Safeguards

- **Confidence column:** Each row gets an `ai_confidence` column (high/medium/low) based on how certain the AI mapping is
- **Review CSV:** Sorted by confidence (low first) so user reviews the uncertain ones first
- **No batch data without GRN:** Stock quantities are imported but batch-level tracking requires a separate GRN process
- **Conservative scheduling:** Default to Schedule H (requires prescription) for anything that's not clearly OTC. Better to over-restrict than under-restrict.

## Known Brand Patterns (Supracyn Pharma)

| Suffix | Example | Likely Generic |
|--------|---------|----------------|
| CYN | ATORCYN → Atorvastatin | Statin |
| DAX | DAPADAX → Dapagliflozin | SGLT2 inhibitor |
| SKY | AMLOSKY → Amlodipine | CCB |
| DER | NEBIDER → Nebivolol | Beta blocker |

## Files

- **Input:** `C:\Users\pc\Downloads\StockSummaryReport_08_04_26.pdf`
- **Script:** `apps/backend/src/scripts/enrich-stock-report.ts` (new)
- **Output:** `apps/backend/data/stock-import-review.csv`
- **Import:** `apps/backend/src/scripts/import-products.ts` (existing)
- **CSV template:** `apps/backend/data/products.csv` (existing, reference for column format)

## Estimated Unique Products After Dedup

Based on PDF analysis: ~1,151 raw items → ~400-500 unique products after removing (EXTRA) variants, normalizing names, and filtering junk entries.
