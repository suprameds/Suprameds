/**
 * Phase 1: Parse stock report PDF data and deduplicate into unique products.
 *
 * Input: Raw text lines from StockSummaryReport_08_04_26.pdf
 * Output: apps/backend/data/stock-parsed.json (deduplicated products)
 *
 * Run: node apps/backend/scripts/parse-stock-report.mjs
 */
import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Raw data extracted from PDF (all 1151 items)
// Format: [item_name, sale_price, purchase_price, stock_qty]
const RAW_LINES_FILE = join(__dirname, "..", "data", "stock-raw-lines.json")
const OUTPUT_FILE = join(__dirname, "..", "data", "stock-parsed.json")

// Read raw lines
const rawLines = JSON.parse(readFileSync(RAW_LINES_FILE, "utf8"))

console.log(`Loaded ${rawLines.length} raw line items`)

// ── Step 1: Filter junk entries ──────────────────────────────────
const JUNK_NAMES = new Set([
  "AT", "PI", "XY", "su", "mul", "multi", "NEU", "MINDA", "FLOACI",
  "GLICIA", "VILDADER", "VILDIBETA", "URIDAX", "TOSCAS", "SUEPRTEL-H",
  "SUPAN", "paracyn", "nebicia", "glimcyn", "GLIMCYNMET", "daxynac",
  "DEXAGEST", "STORCYN 500", "CRED", "MC-24965", "TELNBETA -M",
  "VORGUN M", "VORGUN-GM 1", "VILDAX", "TEZ-CEE", "ROZUCY",
  "CUROLITE 500", "CYNCA"
])

const filtered = rawLines.filter(item => {
  const name = item.name.trim()
  // Skip junk names
  if (JUNK_NAMES.has(name)) return false
  // Skip items with ₹0 sale price AND 0 or negative stock
  if (item.sale_price === 0 && item.stock_qty <= 0) return false
  // Skip items with very short names (1-2 chars)
  if (name.length <= 2) return false
  return true
})

console.log(`After junk filter: ${filtered.length} items`)

// ── Step 2: Normalize and deduplicate ────────────────────────────
function normalizeItemName(name) {
  return name
    .toUpperCase()
    .trim()
    // Remove (EXTRA), (EXTRAS), (EXTRASS), etc.
    .replace(/\s*\(EXTRA[S]*\)\s*/gi, "")
    // Remove trailing spaces/hyphens
    .replace(/[\s-]+$/, "")
    // Normalize multiple spaces
    .replace(/\s+/g, " ")
    // Normalize hyphens: "ATORCYN -10" → "ATORCYN-10"
    .replace(/\s*-\s*/g, "-")
    // Normalize "ATORCYN 10MG" → "ATORCYN-10"
    .replace(/[\s-](\d+)\s*MG\b/gi, "-$1")
    // Normalize "ATORCYN 10 MG" → "ATORCYN-10"
    .replace(/[\s-](\d+)\s+MG\b/gi, "-$1")
}

// Group by normalized name
const groups = new Map()

for (const item of filtered) {
  const key = normalizeItemName(item.name)
  if (!groups.has(key)) {
    groups.set(key, {
      normalized_name: key,
      original_names: [],
      max_sale_price: 0,
      max_purchase_price: 0,
      total_stock: 0,
      total_value: 0,
    })
  }
  const group = groups.get(key)
  group.original_names.push(item.name)
  group.max_sale_price = Math.max(group.max_sale_price, item.sale_price)
  group.max_purchase_price = Math.max(group.max_purchase_price, item.purchase_price)
  group.total_stock += item.stock_qty
  group.total_value += item.stock_value
}

console.log(`After dedup: ${groups.size} unique products`)

// ── Step 3: Extract strength and dosage form ─────────────────────
function extractStrengthAndForm(name) {
  let strength = ""
  let dosage_form = "tablet" // default

  // Extract strength: number at end of name
  const strengthMatch = name.match(/[\s-](\d+\.?\d*)\s*$/i)
  if (strengthMatch) {
    strength = strengthMatch[1] + "mg"
  }

  // Check for specific strength patterns
  const specificStrength = name.match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/i)
  if (specificStrength) {
    strength = `${specificStrength[1]}/${specificStrength[2]}mg`
  }

  // Extract dosage form from name
  const formMap = {
    "SYP": "syrup",
    "SYR": "syrup",
    "SYRUP": "syrup",
    "SUS": "suspension",
    "DROPS": "drops",
    "DROP": "drops",
    "CREAM": "cream",
    "GEL": "gel",
    "OINTMENT": "ointment",
    "SPRAY": "spray",
    "POWDER": "powder",
    "LOTION": "lotion",
    "MOUTHWASH": "mouthwash",
    "MOUTH WASH": "mouthwash",
    "TAB": "tablet",
    "CAPS": "capsule",
    "CAP": "capsule",
    "SR": "tablet", // sustained release tablet
    "CR": "tablet", // controlled release tablet
    "ER": "tablet", // extended release tablet
    "MR": "tablet", // modified release tablet
    "DR": "tablet", // delayed release tablet
    "OD": "tablet", // once daily tablet
    "XL": "tablet", // extended release
    "XR": "tablet", // extended release
    "MD": "tablet", // mouth dissolving
    "DT": "tablet", // dispersible tablet
  }

  const upperName = name.toUpperCase()
  for (const [key, form] of Object.entries(formMap)) {
    if (upperName.includes(` ${key}`) || upperName.endsWith(` ${key}`) || upperName.includes(`-${key}`)) {
      dosage_form = form
      break
    }
  }

  return { strength, dosage_form }
}

// Extract brand base name (without strength)
function extractBrandBase(name) {
  return name
    .replace(/[\s-]\d+\.?\d*\s*\/?\s*\d*\.?\d*\s*$/i, "") // Remove trailing numbers
    .replace(/\s+(SR|CR|ER|MR|DR|OD|XL|XR|MD|DT|FORTE|PLUS|GOLD|TRIO|HF)\s*$/i, "") // Remove release type
    .replace(/\s+(SYP|SYR|SUS|DROPS|CREAM|GEL|SPRAY|POWDER|LOTION|TAB|CAPS)\s*$/i, "") // Remove form
    .trim()
}

// ── Step 4: Build output ─────────────────────────────────────────
const products = []

for (const [key, group] of groups) {
  const { strength, dosage_form } = extractStrengthAndForm(key)
  const brand_base = extractBrandBase(key)

  products.push({
    normalized_name: key,
    brand_base,
    strength,
    dosage_form,
    mrp: group.max_sale_price,
    purchase_price: group.max_purchase_price,
    stock_qty: Math.max(0, group.total_stock), // clamp negative to 0
    stock_value: group.total_value,
    original_names: group.original_names,
    variant_count: group.original_names.length,
  })
}

// Sort by brand_base then strength
products.sort((a, b) => a.brand_base.localeCompare(b.brand_base) || a.normalized_name.localeCompare(b.normalized_name))

// Filter out products with ₹0 MRP (can't sell without MRP)
const sellable = products.filter(p => p.mrp > 0)
const zeroMrp = products.filter(p => p.mrp === 0)

console.log(`\nFinal: ${sellable.length} sellable products (${zeroMrp.length} with ₹0 MRP skipped)`)
console.log(`\nTop 20 products by stock value:`)
const byValue = [...sellable].sort((a, b) => b.stock_value - a.stock_value)
for (const p of byValue.slice(0, 20)) {
  console.log(`  ${p.normalized_name.padEnd(35)} MRP ₹${p.mrp.toFixed(2).padStart(8)} Stock: ${String(p.stock_qty).padStart(5)} Value: ₹${p.stock_value.toFixed(2).padStart(10)}`)
}

// Write output
writeFileSync(OUTPUT_FILE, JSON.stringify({ products: sellable, skipped_zero_mrp: zeroMrp }, null, 2))
console.log(`\nWritten to ${OUTPUT_FILE}`)
