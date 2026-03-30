/**
 * 009 — Clean test product seed.
 *
 * Replaces 005–008. Deletes any existing test products, then creates
 * 10 fresh products with inventory, stock levels, drug metadata, and
 * 3 FEFO batches each (40+35+25 = 100 units).
 *
 * Key fixes vs previous attempts:
 *   - Does NOT call createInventoryItemsWorkflow (Medusa auto-creates them)
 *   - Finds inventory items via variant link, NOT by creating new ones
 *   - Sets stock via inventoryService directly, NOT via workflow
 *   - Throws on any failure so Medusa retries next deploy
 */

import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  deleteProductsWorkflow,
  batchLinkProductsToCategoryWorkflow,
} from "@medusajs/medusa/core-flows"
import { PHARMA_MODULE } from "../modules/pharma"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:009-seed-test-products")

// ── Product data ───────────────────────────────────────────────────────

interface BatchDef {
  lot: string; exp: string; mfg: string; mrp: number; cost: number
  supplier: string; grn: string; qty: number
}

interface ProductDef {
  brandName: string; genericName: string; composition: string
  strength: string; dosageForm: string; packSize: string; unitType: string
  schedule: string; therapeuticClass: string; categoryHandle: string
  collectionTitle: string; sell: number; mrp: number; gstRate: number
  hsnCode: string; manufacturer: string; mfgLicense: string
  description: string; indications: string; contraindications: string
  sideEffects: string; storage: string; dosage: string
  isChronic: boolean; habitForming: boolean; requiresRefrig: boolean
  isNarcotic: boolean; tags: string[]
  batches: BatchDef[]
}

const PRODUCTS: ProductDef[] = [
  {
    brandName: "Dolo 650", genericName: "Paracetamol", composition: "Paracetamol 650mg",
    strength: "650mg", dosageForm: "tablet", packSize: "15 tablets", unitType: "strip",
    schedule: "OTC", therapeuticClass: "Analgesic / Antipyretic",
    categoryHandle: "pain-fever", collectionTitle: "Pain & Fever",
    sell: 22, mrp: 32, gstRate: 5, hsnCode: "30049099",
    manufacturer: "Micro Labs Ltd", mfgLicense: "KTK/25/078/2007",
    description: "Dolo 650 (Paracetamol 650mg) by Micro Labs — trusted analgesic and antipyretic for fast relief from pain and fever.",
    indications: "Fever; Headache; Body ache; Toothache; Muscle pain; Post-vaccination fever",
    contraindications: "Severe hepatic impairment; Hypersensitivity to paracetamol; Alcohol dependence",
    sideEffects: "Nausea; Skin rash (rare); Hepatotoxicity on overdose",
    storage: "Store below 30°C in dry place away from direct sunlight",
    dosage: "Adults: 1-2 tablets every 4-6 hours. Max 8 tablets per day.",
    isChronic: false, habitForming: false, requiresRefrig: false, isNarcotic: false,
    tags: ["otc"],
    batches: [
      { lot: "LOT-DOLO-2024-A", exp: "2026-09-30", mfg: "2024-09-01", mrp: 32, cost: 14, supplier: "Micro Labs Ltd", grn: "GRN-SM-202409-001", qty: 40 },
      { lot: "LOT-DOLO-2025-B", exp: "2027-03-31", mfg: "2025-03-01", mrp: 32, cost: 14, supplier: "Micro Labs Ltd", grn: "GRN-SM-202503-001", qty: 35 },
      { lot: "LOT-DOLO-2025-C", exp: "2027-09-30", mfg: "2025-09-01", mrp: 32, cost: 14, supplier: "Micro Labs Ltd", grn: "GRN-SM-202509-001", qty: 25 },
    ],
  },
  {
    brandName: "Glycomet SR 500", genericName: "Metformin", composition: "Metformin Hydrochloride 500mg (Sustained Release)",
    strength: "500mg", dosageForm: "tablet", packSize: "10 tablets", unitType: "strip",
    schedule: "H", therapeuticClass: "Antidiabetic (Biguanide)",
    categoryHandle: "diabetic", collectionTitle: "Antidiabetic",
    sell: 33, mrp: 48, gstRate: 5, hsnCode: "30049099",
    manufacturer: "USV Ltd", mfgLicense: "MH/DL/95/2004",
    description: "Glycomet SR 500 (Metformin HCl 500mg SR) by USV — first-line oral antidiabetic for Type 2 Diabetes management.",
    indications: "Type 2 Diabetes Mellitus; Insulin resistance; PCOS (adjunct therapy)",
    contraindications: "Renal impairment (eGFR below 30); Metabolic acidosis; Hepatic impairment",
    sideEffects: "GI disturbance; Diarrhoea; Nausea; Metallic taste",
    storage: "Store below 30°C in dry place away from moisture",
    dosage: "One tablet twice daily with meals. Swallow whole — do not crush.",
    isChronic: true, habitForming: false, requiresRefrig: false, isNarcotic: false,
    tags: ["rx_required", "schedule_h", "chronic"],
    batches: [
      { lot: "LOT-MET-2024-A", exp: "2026-09-30", mfg: "2024-09-01", mrp: 48, cost: 21, supplier: "USV Ltd", grn: "GRN-SM-202409-002", qty: 40 },
      { lot: "LOT-MET-2025-B", exp: "2027-03-31", mfg: "2025-03-01", mrp: 48, cost: 21, supplier: "USV Ltd", grn: "GRN-SM-202503-002", qty: 35 },
      { lot: "LOT-MET-2025-C", exp: "2027-09-30", mfg: "2025-09-01", mrp: 48, cost: 21, supplier: "USV Ltd", grn: "GRN-SM-202509-002", qty: 25 },
    ],
  },
  {
    brandName: "Telma 40", genericName: "Telmisartan", composition: "Telmisartan 40mg",
    strength: "40mg", dosageForm: "tablet", packSize: "14 tablets", unitType: "strip",
    schedule: "H", therapeuticClass: "Antihypertensive (ARB)",
    categoryHandle: "hypertension", collectionTitle: "Cardiology",
    sell: 82, mrp: 120, gstRate: 5, hsnCode: "30049099",
    manufacturer: "Glenmark Pharmaceuticals", mfgLicense: "MH/DL/97/2006",
    description: "Telma 40 (Telmisartan 40mg) by Glenmark — ARB for hypertension and cardiovascular risk reduction.",
    indications: "Hypertension; Cardiovascular risk reduction; Diabetic nephropathy",
    contraindications: "Pregnancy; Bilateral renal artery stenosis; Hyperkalaemia",
    sideEffects: "Dizziness; Hyperkalaemia; Elevated serum creatinine; Back pain",
    storage: "Store below 30°C in dry place away from moisture",
    dosage: "One tablet once daily with or without food.",
    isChronic: true, habitForming: false, requiresRefrig: false, isNarcotic: false,
    tags: ["rx_required", "schedule_h", "chronic"],
    batches: [
      { lot: "LOT-TELMA-2024-A", exp: "2026-09-30", mfg: "2024-09-01", mrp: 120, cost: 52, supplier: "Glenmark Pharmaceuticals", grn: "GRN-SM-202409-003", qty: 40 },
      { lot: "LOT-TELMA-2025-B", exp: "2027-03-31", mfg: "2025-03-01", mrp: 120, cost: 52, supplier: "Glenmark Pharmaceuticals", grn: "GRN-SM-202503-003", qty: 35 },
      { lot: "LOT-TELMA-2025-C", exp: "2027-09-30", mfg: "2025-09-01", mrp: 120, cost: 52, supplier: "Glenmark Pharmaceuticals", grn: "GRN-SM-202509-003", qty: 25 },
    ],
  },
  {
    brandName: "Atorva 10", genericName: "Atorvastatin", composition: "Atorvastatin Calcium 10mg",
    strength: "10mg", dosageForm: "tablet", packSize: "10 tablets", unitType: "strip",
    schedule: "H", therapeuticClass: "Antilipidemic (Statin)",
    categoryHandle: "cholesterol", collectionTitle: "Cardiology",
    sell: 46, mrp: 68, gstRate: 5, hsnCode: "30049099",
    manufacturer: "Zydus Lifesciences", mfgLicense: "GJ/DL/145/2005",
    description: "Atorva 10 (Atorvastatin 10mg) by Zydus — statin for dyslipidaemia and cardiovascular risk reduction.",
    indications: "Hypercholesterolaemia; Mixed dyslipidaemia; CV event prevention",
    contraindications: "Active hepatic disease; Pregnancy; Lactation",
    sideEffects: "Myopathy; Elevated liver enzymes; Headache; Rhabdomyolysis (rare)",
    storage: "Store below 30°C in dry place away from moisture",
    dosage: "One tablet once daily at any time of day.",
    isChronic: true, habitForming: false, requiresRefrig: false, isNarcotic: false,
    tags: ["rx_required", "schedule_h", "chronic"],
    batches: [
      { lot: "LOT-ATORVA-2024-A", exp: "2026-09-30", mfg: "2024-09-01", mrp: 68, cost: 30, supplier: "Zydus Lifesciences", grn: "GRN-SM-202409-004", qty: 40 },
      { lot: "LOT-ATORVA-2025-B", exp: "2027-03-31", mfg: "2025-03-01", mrp: 68, cost: 30, supplier: "Zydus Lifesciences", grn: "GRN-SM-202503-004", qty: 35 },
      { lot: "LOT-ATORVA-2025-C", exp: "2027-09-30", mfg: "2025-09-01", mrp: 68, cost: 30, supplier: "Zydus Lifesciences", grn: "GRN-SM-202509-004", qty: 25 },
    ],
  },
  {
    brandName: "Pan 40", genericName: "Pantoprazole", composition: "Pantoprazole Sodium 40mg",
    strength: "40mg", dosageForm: "tablet", packSize: "15 tablets", unitType: "strip",
    schedule: "H", therapeuticClass: "Proton Pump Inhibitor",
    categoryHandle: "gastroenterology", collectionTitle: "Gastro",
    sell: 49, mrp: 72, gstRate: 5, hsnCode: "30049099",
    manufacturer: "Alkem Laboratories", mfgLicense: "MH/DL/123/2008",
    description: "Pan 40 (Pantoprazole 40mg) by Alkem — PPI for GERD and peptic ulcer treatment.",
    indications: "GERD; Peptic ulcer; Zollinger-Ellison syndrome; NSAID ulcer prophylaxis",
    contraindications: "Hypersensitivity to benzimidazoles; Co-admin with rilpivirine",
    sideEffects: "Headache; Diarrhoea; Nausea; Hypomagnesaemia on long-term use",
    storage: "Store below 30°C in dry place. Keep away from moisture.",
    dosage: "One tablet once daily 30 minutes before breakfast. Do not crush.",
    isChronic: false, habitForming: false, requiresRefrig: false, isNarcotic: false,
    tags: ["rx_required", "schedule_h"],
    batches: [
      { lot: "LOT-PAN-2024-A", exp: "2026-09-30", mfg: "2024-09-01", mrp: 72, cost: 32, supplier: "Alkem Laboratories", grn: "GRN-SM-202409-005", qty: 40 },
      { lot: "LOT-PAN-2025-B", exp: "2027-03-31", mfg: "2025-03-01", mrp: 72, cost: 32, supplier: "Alkem Laboratories", grn: "GRN-SM-202503-005", qty: 35 },
      { lot: "LOT-PAN-2025-C", exp: "2027-09-30", mfg: "2025-09-01", mrp: 72, cost: 32, supplier: "Alkem Laboratories", grn: "GRN-SM-202509-005", qty: 25 },
    ],
  },
  {
    brandName: "Azithral 500", genericName: "Azithromycin", composition: "Azithromycin 500mg",
    strength: "500mg", dosageForm: "tablet", packSize: "3 tablets", unitType: "strip",
    schedule: "H", therapeuticClass: "Antibiotic (Macrolide)",
    categoryHandle: "antibiotics", collectionTitle: "Antibiotics",
    sell: 65, mrp: 95, gstRate: 5, hsnCode: "30042000",
    manufacturer: "Alembic Pharmaceuticals", mfgLicense: "GJ/DL/89/2003",
    description: "Azithral 500 (Azithromycin 500mg) by Alembic — macrolide antibiotic for respiratory and skin infections.",
    indications: "Community-acquired pneumonia; Pharyngitis; Sinusitis; Skin infections",
    contraindications: "Hypersensitivity to macrolides; QT prolongation; Hepatic disease",
    sideEffects: "Diarrhoea; Nausea; Abdominal pain; QT prolongation (rare)",
    storage: "Store below 30°C in dry place away from moisture",
    dosage: "One tablet (500mg) once daily for 3 consecutive days. Complete full course.",
    isChronic: false, habitForming: false, requiresRefrig: false, isNarcotic: false,
    tags: ["rx_required", "schedule_h"],
    batches: [
      { lot: "LOT-AZIO-2024-A", exp: "2026-09-30", mfg: "2024-09-01", mrp: 95, cost: 42, supplier: "Alembic Pharmaceuticals", grn: "GRN-SM-202409-006", qty: 40 },
      { lot: "LOT-AZIO-2025-B", exp: "2027-03-31", mfg: "2025-03-01", mrp: 95, cost: 42, supplier: "Alembic Pharmaceuticals", grn: "GRN-SM-202503-006", qty: 35 },
      { lot: "LOT-AZIO-2025-C", exp: "2027-09-30", mfg: "2025-09-01", mrp: 95, cost: 42, supplier: "Alembic Pharmaceuticals", grn: "GRN-SM-202509-006", qty: 25 },
    ],
  },
  {
    brandName: "Cetzine 10", genericName: "Cetirizine", composition: "Cetirizine Hydrochloride 10mg",
    strength: "10mg", dosageForm: "tablet", packSize: "10 tablets", unitType: "strip",
    schedule: "OTC", therapeuticClass: "Antihistamine",
    categoryHandle: "general-medicines", collectionTitle: "Pain & Fever",
    sell: 19, mrp: 28, gstRate: 5, hsnCode: "30049099",
    manufacturer: "Dr. Reddy's Laboratories", mfgLicense: "AP/DL/87/2001",
    description: "Cetzine 10 (Cetirizine 10mg) by Dr. Reddy's — antihistamine for allergic rhinitis and urticaria.",
    indications: "Allergic rhinitis; Urticaria; Hay fever; Allergic conjunctivitis",
    contraindications: "Severe renal impairment; Hypersensitivity to cetirizine or hydroxyzine",
    sideEffects: "Drowsiness; Dry mouth; Fatigue; Headache",
    storage: "Store below 30°C in dry place away from sunlight",
    dosage: "One tablet once daily. Avoid driving if drowsy.",
    isChronic: false, habitForming: false, requiresRefrig: false, isNarcotic: false,
    tags: ["otc"],
    batches: [
      { lot: "LOT-CET-2024-A", exp: "2026-09-30", mfg: "2024-09-01", mrp: 28, cost: 12, supplier: "Dr. Reddy's Laboratories", grn: "GRN-SM-202409-007", qty: 40 },
      { lot: "LOT-CET-2025-B", exp: "2027-03-31", mfg: "2025-03-01", mrp: 28, cost: 12, supplier: "Dr. Reddy's Laboratories", grn: "GRN-SM-202503-007", qty: 35 },
      { lot: "LOT-CET-2025-C", exp: "2027-09-30", mfg: "2025-09-01", mrp: 28, cost: 12, supplier: "Dr. Reddy's Laboratories", grn: "GRN-SM-202509-007", qty: 25 },
    ],
  },
  {
    brandName: "Amlong 5", genericName: "Amlodipine", composition: "Amlodipine Besylate 5mg",
    strength: "5mg", dosageForm: "tablet", packSize: "14 tablets", unitType: "strip",
    schedule: "H", therapeuticClass: "Antihypertensive (CCB)",
    categoryHandle: "hypertension", collectionTitle: "Cardiology",
    sell: 37, mrp: 55, gstRate: 5, hsnCode: "30049099",
    manufacturer: "Micro Labs Ltd", mfgLicense: "KTK/25/078/2007",
    description: "Amlong 5 (Amlodipine 5mg) by Micro Labs — calcium channel blocker for hypertension and stable angina.",
    indications: "Hypertension; Stable angina; Vasospastic angina",
    contraindications: "Severe aortic stenosis; Cardiogenic shock; Unstable heart failure",
    sideEffects: "Peripheral oedema; Headache; Dizziness; Flushing",
    storage: "Store below 30°C in dry place away from moisture",
    dosage: "One tablet once daily. Do not abruptly discontinue.",
    isChronic: true, habitForming: false, requiresRefrig: false, isNarcotic: false,
    tags: ["rx_required", "schedule_h", "chronic"],
    batches: [
      { lot: "LOT-AML-2024-A", exp: "2026-09-30", mfg: "2024-09-01", mrp: 55, cost: 24, supplier: "Micro Labs Ltd", grn: "GRN-SM-202409-008", qty: 40 },
      { lot: "LOT-AML-2025-B", exp: "2027-03-31", mfg: "2025-03-01", mrp: 55, cost: 24, supplier: "Micro Labs Ltd", grn: "GRN-SM-202503-008", qty: 35 },
      { lot: "LOT-AML-2025-C", exp: "2027-09-30", mfg: "2025-09-01", mrp: 55, cost: 24, supplier: "Micro Labs Ltd", grn: "GRN-SM-202509-008", qty: 25 },
    ],
  },
  {
    brandName: "Calcirol D3 60000", genericName: "Cholecalciferol", composition: "Cholecalciferol (Vitamin D3) 60000 IU",
    strength: "60000 IU", dosageForm: "capsule", packSize: "4 capsules", unitType: "strip",
    schedule: "OTC", therapeuticClass: "Vitamin / Bone Health",
    categoryHandle: "vitamins-supplements", collectionTitle: "Vitamins",
    sell: 122, mrp: 180, gstRate: 5, hsnCode: "30049099",
    manufacturer: "Cadila Pharmaceuticals", mfgLicense: "GJ/DL/67/2000",
    description: "Calcirol D3 60000 (Cholecalciferol 60000 IU) by Cadila — weekly Vitamin D3 for deficiency and bone health.",
    indications: "Vitamin D deficiency; Osteomalacia; Rickets; Osteoporosis prevention",
    contraindications: "Hypercalcaemia; Hypervitaminosis D; Sarcoidosis",
    sideEffects: "Nausea; Weakness; Constipation (high doses); Hypercalcaemia on toxicity",
    storage: "Store below 25°C in dry place away from direct sunlight",
    dosage: "One capsule weekly for 8-12 weeks. Monthly maintenance thereafter.",
    isChronic: false, habitForming: false, requiresRefrig: false, isNarcotic: false,
    tags: ["otc"],
    batches: [
      { lot: "LOT-CALC-2024-A", exp: "2026-09-30", mfg: "2024-09-01", mrp: 180, cost: 79, supplier: "Cadila Pharmaceuticals", grn: "GRN-SM-202409-009", qty: 40 },
      { lot: "LOT-CALC-2025-B", exp: "2027-03-31", mfg: "2025-03-01", mrp: 180, cost: 79, supplier: "Cadila Pharmaceuticals", grn: "GRN-SM-202503-009", qty: 35 },
      { lot: "LOT-CALC-2025-C", exp: "2027-09-30", mfg: "2025-09-01", mrp: 180, cost: 79, supplier: "Cadila Pharmaceuticals", grn: "GRN-SM-202509-009", qty: 25 },
    ],
  },
  {
    brandName: "Omez 20", genericName: "Omeprazole", composition: "Omeprazole 20mg",
    strength: "20mg", dosageForm: "capsule", packSize: "10 capsules", unitType: "strip",
    schedule: "H", therapeuticClass: "Proton Pump Inhibitor",
    categoryHandle: "gastroenterology", collectionTitle: "Gastro",
    sell: 26, mrp: 38, gstRate: 5, hsnCode: "30049099",
    manufacturer: "Dr. Reddy's Laboratories", mfgLicense: "AP/DL/87/2001",
    description: "Omez 20 (Omeprazole 20mg) by Dr. Reddy's — PPI for peptic ulcer and acid-related disorders.",
    indications: "Peptic ulcer; GERD; H. pylori eradication; Zollinger-Ellison syndrome",
    contraindications: "Hypersensitivity to benzimidazoles; Co-admin with rilpivirine",
    sideEffects: "Headache; Diarrhoea; Nausea; Hypomagnesaemia on prolonged use",
    storage: "Store below 30°C in dry place away from moisture and heat",
    dosage: "One capsule once daily 30 minutes before meals. Swallow whole.",
    isChronic: false, habitForming: false, requiresRefrig: false, isNarcotic: false,
    tags: ["rx_required", "schedule_h"],
    batches: [
      { lot: "LOT-OMEZ-2024-A", exp: "2026-09-30", mfg: "2024-09-01", mrp: 38, cost: 17, supplier: "Dr. Reddy's Laboratories", grn: "GRN-SM-202409-010", qty: 40 },
      { lot: "LOT-OMEZ-2025-B", exp: "2027-03-31", mfg: "2025-03-01", mrp: 38, cost: 17, supplier: "Dr. Reddy's Laboratories", grn: "GRN-SM-202503-010", qty: 35 },
      { lot: "LOT-OMEZ-2025-C", exp: "2027-09-30", mfg: "2025-09-01", mrp: 38, cost: 17, supplier: "Dr. Reddy's Laboratories", grn: "GRN-SM-202509-010", qty: 25 },
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function makeSku(handle: string): string {
  return `SUPRA-${handle.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 48)
}

// ── Main ─────────────────────────────────────────────────────────────────

export default async function seedTestProducts({
  container,
}: {
  container: MedusaContainer
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryService = container.resolve(Modules.INVENTORY) as any
  const pharmaService = container.resolve(PHARMA_MODULE) as any
  const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
  const fulfillmentService = container.resolve(ModuleRegistrationName.FULFILLMENT) as any
  const salesChannelService = container.resolve(ModuleRegistrationName.SALES_CHANNEL) as any

  // ── Prerequisites ──────────────────────────────────────────────────

  const [salesChannel] = await salesChannelService.listSalesChannels({ name: "Default Sales Channel" })
  if (!salesChannel?.id) throw new Error("009: Default Sales Channel missing")

  const [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" })
  if (!shippingProfile?.id) throw new Error("009: Default shipping profile missing")

  const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id", "name"] })
  const locationId = (locations as any[])?.[0]?.id
  if (!locationId) throw new Error("009: No stock location found")

  const { data: categories } = await query.graph({ entity: "product_category", fields: ["id", "handle"] })
  const catMap = new Map((categories as any[]).map((c) => [c.handle, c.id]))

  const { data: collections } = await query.graph({ entity: "product_collection", fields: ["id", "title"] })
  const colMap = new Map((collections as any[]).map((c) => [c.title, c.id]))

  logger.info(`009: location=${locationId}, ${catMap.size} categories, ${colMap.size} collections`)

  // ── Phase 1: Delete existing test products ─────────────────────────

  const handles = PRODUCTS.map((p) => slugify(p.brandName))
  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: handles },
  })

  if ((existing as any[]).length > 0) {
    const ids = (existing as any[]).map((p: any) => p.id)
    logger.info(`009: deleting ${ids.length} existing test products...`)

    // Delete drug metadata
    for (const pid of ids) {
      try {
        const drugs = await pharmaService.listDrugProducts({ product_id: pid })
        if (drugs.length) await pharmaService.deleteDrugProducts(drugs.map((d: any) => d.id))
      } catch { /* ok if none */ }
    }

    // Delete batches
    for (const pid of ids) {
      try {
        const batches = await batchService.listBatches({ product_id: pid })
        if (batches.length) await batchService.deleteBatches(batches.map((b: any) => b.id))
      } catch { /* ok if none */ }
    }

    // Delete products (cascades to variants, inventory items, links)
    await deleteProductsWorkflow(container).run({ input: { ids } })
    logger.info(`009: deleted ${ids.length} products`)

    // Brief pause for cascade cleanup
    await new Promise((r) => setTimeout(r, 1000))
  }

  // ── Phase 2: Create fresh ──────────────────────────────────────────

  let created = 0

  for (const p of PRODUCTS) {
    const handle = slugify(p.brandName)
    const sku = makeSku(handle)
    const totalQty = p.batches.reduce((s, b) => s + b.qty, 0)

    try {
      // 1. Create product + variant (auto-creates inventory item)
      const { result: createdProducts } = await createProductsWorkflow(container).run({
        input: {
          products: [{
            title: p.brandName, handle,
            description: p.description,
            status: "published",
            sales_channels: [{ id: salesChannel.id }],
            collection_id: colMap.get(p.collectionTitle) ?? null,
            options: [{ title: "Pack", values: ["default"] }],
            variants: [{
              title: p.brandName, sku,
              options: { Pack: "default" },
              prices: [{ currency_code: "inr", amount: p.sell }],
              manage_inventory: true,
              allow_backorder: false,
            }],
            shipping_profile_id: shippingProfile.id,
            metadata: { source: "seed:009", pharma: true, manufacturer: p.manufacturer },
          }],
        },
      })

      const product = (createdProducts as any[])[0]
      if (!product?.id) throw new Error(`product creation returned no ID`)

      // 2. Find auto-created inventory item via variant link
      const { data: variants } = await query.graph({
        entity: "variant",
        fields: ["id", "inventory_items.id"],
        filters: { product_id: [product.id] },
      })
      const variantId = (variants as any[])[0]?.id
      const invItemId = (variants as any[])[0]?.inventory_items?.[0]?.id

      // 3. Set stock level via inventory service (NOT workflow)
      if (invItemId) {
        // Check if level already exists at this location
        const [existingLevels] = await inventoryService.listInventoryLevels({
          inventory_item_id: invItemId,
          location_id: locationId,
        })

        if (existingLevels?.length > 0) {
          await inventoryService.updateInventoryLevels({
            id: existingLevels[0].id,
            stocked_quantity: totalQty,
          })
        } else {
          await inventoryService.createInventoryLevels({
            inventory_item_id: invItemId,
            location_id: locationId,
            stocked_quantity: totalQty,
          })
        }
        logger.info(`009:   ✓ stock: ${totalQty} units at ${locationId}`)
      }

      // 4. Link to category
      const catId = catMap.get(p.categoryHandle)
      if (catId) {
        await batchLinkProductsToCategoryWorkflow(container).run({
          input: { id: catId, add: [product.id], remove: [] },
        })
      }

      // 5. Create drug metadata
      await pharmaService.createDrugProducts({
        product_id: product.id,
        schedule: p.schedule, generic_name: p.genericName,
        therapeutic_class: p.therapeuticClass, dosage_form: p.dosageForm,
        strength: p.strength, composition: p.composition,
        pack_size: p.packSize, unit_type: p.unitType,
        mrp_paise: p.mrp * 100, gst_rate: p.gstRate, hsn_code: p.hsnCode,
        manufacturer_license: p.mfgLicense,
        indications: p.indications, contraindications: p.contraindications,
        side_effects: p.sideEffects, storage_instructions: p.storage,
        dosage_instructions: p.dosage,
        requires_refrigeration: p.requiresRefrig,
        is_narcotic: p.isNarcotic, habit_forming: p.habitForming,
        is_chronic: p.isChronic,
        metadata: { source: "seed:009", manufacturer: p.manufacturer },
      })

      // 6. Create FEFO batches
      if (variantId) {
        for (const b of p.batches) {
          await batchService.createBatches({
            product_variant_id: variantId, product_id: product.id,
            lot_number: b.lot, manufactured_on: b.mfg, expiry_date: b.exp,
            received_quantity: b.qty, available_quantity: b.qty, reserved_quantity: 0,
            batch_mrp_paise: b.mrp * 100, purchase_price_paise: b.cost * 100,
            location_id: locationId, supplier_name: b.supplier,
            grn_number: b.grn, received_on: new Date().toISOString(),
            status: "active", metadata: { source: "seed:009" },
          })
          logger.info(`009:   ↳ ${b.lot} (qty: ${b.qty}, exp: ${b.exp})`)
        }
      }

      logger.info(`009: CREATED "${p.brandName}" — ${totalQty} units, ${p.batches.length} batches`)
      created++
    } catch (err: any) {
      logger.error(`009: FAILED "${p.brandName}": ${err.message}`)
      throw err // Let Medusa retry next deploy
    }
  }

  logger.info(`009: done. Created ${created}/10 products.`)
}
