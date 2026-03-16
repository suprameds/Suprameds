import { model } from "@medusajs/framework/utils"

/**
 * DrugProduct — extends Medusa Product with India-specific pharma metadata.
 * Linked to Medusa's product entity via src/links/product-drug.ts
 *
 * Schedule classification controls sale eligibility:
 *   OTC   — Over-the-counter, no Rx needed
 *   H     — Prescription required (most common Rx drugs)
 *   H1    — Strict Rx drugs (higher abuse potential)
 *   X     — ABSOLUTE PROHIBITION on online sale (NDPS Act, 1985)
 */
const DrugProduct = model.define("drug_product", {
  id: model.id().primaryKey(),

  // Medusa product ID — the FK for the read-only link
  product_id: model.text().unique(),

  // --- Schedule & Regulatory ---
  // OTC | H | H1 | X
  schedule: model.enum(["OTC", "H", "H1", "X"]).default("OTC"),

  // Indian drug regulatory class
  drug_class: model.text().nullable(),

  // CDSCO approval/registration number
  cdsco_reg_no: model.text().nullable(),

  // Manufacturer license number (Form 25 / 28)
  manufacturer_license: model.text().nullable(),

  // --- Drug Identification ---
  // Generic/INN name (e.g., Paracetamol)
  generic_name: model.text(),

  // Therapeutic category (e.g., Analgesic, Antibiotic)
  therapeutic_class: model.text().nullable(),

  // Dosage form: tablet | capsule | syrup | suspension | cream | drops | injection | inhaler | patch | other
  dosage_form: model.enum([
    "tablet",
    "capsule",
    "syrup",
    "suspension",
    "cream",
    "drops",
    "injection",
    "inhaler",
    "patch",
    "other",
  ]).default("tablet"),

  // Strength per unit (e.g., "500mg", "250mg/5ml")
  strength: model.text().nullable(),

  // Full composition string (e.g., "Paracetamol 500mg + Caffeine 65mg")
  composition: model.text().nullable(),

  // --- Packaging ---
  // Pack size description (e.g., "10 tablets", "100ml bottle")
  pack_size: model.text().nullable(),

  // Unit type: tablet | strip | bottle | tube | box | sachet | vial | ampoule
  unit_type: model.enum([
    "tablet",
    "strip",
    "bottle",
    "tube",
    "box",
    "sachet",
    "vial",
    "ampoule",
  ]).default("strip"),

  // --- Pricing & Tax ---
  // Maximum Retail Price in paise (₹10 = 1000 paise)
  mrp_paise: model.bigNumber().nullable(),

  // GST rate slab: 0 | 5 | 12 | 18 (percent)
  // Most life-saving drugs: 5% | OTC drugs: 12-18%
  gst_rate: model.number().default(12),

  // HSN code for GST filing
  hsn_code: model.text().nullable(),

  // --- Clinical Info ---
  // Pharmacist-reviewed drug information
  indications: model.text().nullable(),
  contraindications: model.text().nullable(),
  side_effects: model.text().nullable(),
  drug_interactions: model.text().nullable(),
  storage_instructions: model.text().nullable(),
  dosage_instructions: model.text().nullable(),

  // Whether pharmacist has reviewed and approved drug info for publishing
  pharmacist_reviewed: model.boolean().default(false),
  pharmacist_reviewed_by: model.text().nullable(),
  pharmacist_reviewed_at: model.dateTime().nullable(),

  // --- Flags ---
  // Refrigeration required (cold chain — NOT handled by this warehouse, blocks listing if true)
  requires_refrigeration: model.boolean().default(false),

  // Narcotic/psychotropic substance (NDPS — absolute prohibition online)
  is_narcotic: model.boolean().default(false),

  // Habit-forming declaration required on label
  habit_forming: model.boolean().default(false),

  // For chronic conditions — enables reorder reminder flow
  is_chronic: model.boolean().default(false),

  // Internal metadata
  metadata: model.json().nullable(),
})

export default DrugProduct
