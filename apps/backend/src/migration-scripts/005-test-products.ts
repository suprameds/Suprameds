/**
 * Test product seed migration.
 *
 * Seeds 10 real-world Indian generic medicines with 3 FEFO batches each
 * (40 + 35 + 25 = 100 units per product). Runs automatically on every
 * fresh Medusa Cloud deploy via run-migrations.ts.
 *
 * Products:
 *   Dolo 650, Glycomet SR 500, Telma 40, Atorva 10, Pan 40,
 *   Azithral 500, Cetzine 10, Amlong 5, Calcirol D3 60000, Omez 20
 *
 * Idempotent: existing products are skipped (matched by handle);
 * existing batch lot numbers are skipped before insert.
 */

import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils"
import {
  batchInventoryItemLevelsWorkflow,
  batchLinkProductsToCategoryWorkflow,
  createInventoryItemsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { PHARMA_MODULE } from "../modules/pharma"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:005-test-products")

// ── Types ─────────────────────────────────────────────────────────────────

interface BatchSeed {
  lotNumber: string
  expiryDate: string
  manufacturedOn: string
  mrp: number
  purchasePrice: number
  supplier: string
  grnNumber: string
  qty: number
}

interface ProductSeed {
  brandName: string
  genericName: string
  composition: string
  strength: string
  dosageForm: "tablet" | "capsule" | "syrup" | "cream" | "drops" | "injection" | "inhaler" | "other"
  packSize: string
  unitType: "tablet" | "strip" | "bottle" | "tube" | "box" | "sachet" | "vial" | "ampoule"
  schedule: "OTC" | "H" | "H1" | "X"
  therapeuticClass: string
  categoryHandle: string
  collectionTitle: string
  sellingPrice: number
  mrp: number
  gstRate: number
  hsnCode: string
  manufacturer: string
  manufacturerLicense: string
  description: string
  indications: string
  contraindications: string
  sideEffects: string
  storageInstructions: string
  dosageInstructions: string
  isChronic: boolean
  habitForming: boolean
  requiresRefrigeration: boolean
  isNarcotic: boolean
  tags: string[]
  batches: BatchSeed[]
}

// ── Product catalogue ──────────────────────────────────────────────────────

const TEST_PRODUCTS: ProductSeed[] = [
  {
    brandName: "Dolo 650",
    genericName: "Paracetamol",
    composition: "Paracetamol 650mg",
    strength: "650mg",
    dosageForm: "tablet",
    packSize: "15 tablets",
    unitType: "strip",
    schedule: "OTC",
    therapeuticClass: "Analgesic / Antipyretic",
    categoryHandle: "pain-fever",
    collectionTitle: "Pain & Fever",
    sellingPrice: 22,
    mrp: 32,
    gstRate: 5,
    hsnCode: "30049099",
    manufacturer: "Micro Labs Ltd",
    manufacturerLicense: "KTK/25/078/2007",
    description:
      "Dolo 650 (Paracetamol 650mg) by Micro Labs — trusted analgesic and antipyretic for fast relief from pain and fever.",
    indications:
      "Fever; Headache; Body ache; Toothache; Muscle pain; Post-vaccination fever",
    contraindications:
      "Severe hepatic impairment; Hypersensitivity to paracetamol; Alcohol dependence",
    sideEffects: "Nausea; Skin rash (rare); Hepatotoxicity on overdose",
    storageInstructions:
      "Store below 30°C in dry place away from direct sunlight and moisture",
    dosageInstructions:
      "Adults: 1-2 tablets every 4-6 hours as needed. Maximum 8 tablets per day. Not for children under 12 without medical advice.",
    isChronic: false,
    habitForming: false,
    requiresRefrigeration: false,
    isNarcotic: false,
    tags: ["otc"],
    batches: [
      { lotNumber: "LOT-DOLO-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 32, purchasePrice: 14, supplier: "Micro Labs Ltd", grnNumber: "GRN-SM-202409-001", qty: 40 },
      { lotNumber: "LOT-DOLO-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 32, purchasePrice: 14, supplier: "Micro Labs Ltd", grnNumber: "GRN-SM-202503-001", qty: 35 },
      { lotNumber: "LOT-DOLO-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 32, purchasePrice: 14, supplier: "Micro Labs Ltd", grnNumber: "GRN-SM-202509-001", qty: 25 },
    ],
  },
  {
    brandName: "Glycomet SR 500",
    genericName: "Metformin",
    composition: "Metformin Hydrochloride 500mg (Sustained Release)",
    strength: "500mg",
    dosageForm: "tablet",
    packSize: "10 tablets",
    unitType: "strip",
    schedule: "H",
    therapeuticClass: "Antidiabetic (Biguanide)",
    categoryHandle: "diabetic",
    collectionTitle: "Antidiabetic",
    sellingPrice: 33,
    mrp: 48,
    gstRate: 5,
    hsnCode: "30049099",
    manufacturer: "USV Ltd",
    manufacturerLicense: "MH/DL/95/2004",
    description:
      "Glycomet SR 500 (Metformin HCl 500mg SR) by USV — first-line oral antidiabetic for Type 2 Diabetes Mellitus management.",
    indications:
      "Type 2 Diabetes Mellitus; Insulin resistance; PCOS (adjunct therapy)",
    contraindications:
      "Renal impairment (eGFR below 30); Metabolic acidosis; Hepatic impairment; IV contrast procedures",
    sideEffects:
      "GI disturbance; Diarrhoea; Nausea; Metallic taste (usually transient on initiation)",
    storageInstructions:
      "Store below 30°C in dry place away from moisture. Keep in original pack.",
    dosageInstructions:
      "One tablet twice daily with morning and evening meals. Swallow whole — do not crush. Dose as directed by physician.",
    isChronic: true,
    habitForming: false,
    requiresRefrigeration: false,
    isNarcotic: false,
    tags: ["rx_required", "schedule_h", "chronic"],
    batches: [
      { lotNumber: "LOT-MET-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 48, purchasePrice: 21, supplier: "USV Ltd", grnNumber: "GRN-SM-202409-002", qty: 40 },
      { lotNumber: "LOT-MET-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 48, purchasePrice: 21, supplier: "USV Ltd", grnNumber: "GRN-SM-202503-002", qty: 35 },
      { lotNumber: "LOT-MET-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 48, purchasePrice: 21, supplier: "USV Ltd", grnNumber: "GRN-SM-202509-002", qty: 25 },
    ],
  },
  {
    brandName: "Telma 40",
    genericName: "Telmisartan",
    composition: "Telmisartan 40mg",
    strength: "40mg",
    dosageForm: "tablet",
    packSize: "14 tablets",
    unitType: "strip",
    schedule: "H",
    therapeuticClass: "Antihypertensive (ARB)",
    categoryHandle: "hypertension",
    collectionTitle: "Cardiology",
    sellingPrice: 82,
    mrp: 120,
    gstRate: 5,
    hsnCode: "30049099",
    manufacturer: "Glenmark Pharmaceuticals",
    manufacturerLicense: "MH/DL/97/2006",
    description:
      "Telma 40 (Telmisartan 40mg) by Glenmark — angiotensin receptor blocker for hypertension and cardiovascular risk reduction.",
    indications:
      "Hypertension; Cardiovascular risk reduction in high-risk patients; Diabetic nephropathy",
    contraindications:
      "Pregnancy; Bilateral renal artery stenosis; Hyperkalaemia; Severe hepatic impairment",
    sideEffects:
      "Dizziness; Hyperkalaemia; Elevated serum creatinine; Back pain",
    storageInstructions:
      "Store below 30°C in dry place away from moisture and sunlight",
    dosageInstructions:
      "One tablet once daily with or without food. Dose adjustment as directed by physician. Do not discontinue abruptly.",
    isChronic: true,
    habitForming: false,
    requiresRefrigeration: false,
    isNarcotic: false,
    tags: ["rx_required", "schedule_h", "chronic"],
    batches: [
      { lotNumber: "LOT-TELMA-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 120, purchasePrice: 52, supplier: "Glenmark Pharmaceuticals", grnNumber: "GRN-SM-202409-003", qty: 40 },
      { lotNumber: "LOT-TELMA-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 120, purchasePrice: 52, supplier: "Glenmark Pharmaceuticals", grnNumber: "GRN-SM-202503-003", qty: 35 },
      { lotNumber: "LOT-TELMA-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 120, purchasePrice: 52, supplier: "Glenmark Pharmaceuticals", grnNumber: "GRN-SM-202509-003", qty: 25 },
    ],
  },
  {
    brandName: "Atorva 10",
    genericName: "Atorvastatin",
    composition: "Atorvastatin Calcium equivalent to Atorvastatin 10mg",
    strength: "10mg",
    dosageForm: "tablet",
    packSize: "10 tablets",
    unitType: "strip",
    schedule: "H",
    therapeuticClass: "Antilipidemic (Statin)",
    categoryHandle: "cholesterol",
    collectionTitle: "Cardiology",
    sellingPrice: 46,
    mrp: 68,
    gstRate: 5,
    hsnCode: "30049099",
    manufacturer: "Zydus Lifesciences",
    manufacturerLicense: "GJ/DL/145/2005",
    description:
      "Atorva 10 (Atorvastatin 10mg) by Zydus — HMG-CoA reductase inhibitor for dyslipidaemia and cardiovascular risk reduction.",
    indications:
      "Primary hypercholesterolaemia; Mixed dyslipidaemia; Primary prevention of cardiovascular events in high-risk patients",
    contraindications:
      "Active hepatic disease; Pregnancy; Lactation; Hypersensitivity to statins; Unexplained persistent elevated serum transaminases",
    sideEffects:
      "Myopathy; Elevated liver enzymes; Headache; GI disturbances; Rhabdomyolysis (rare)",
    storageInstructions: "Store below 30°C in dry place away from moisture",
    dosageInstructions:
      "One tablet once daily at any time of day. Consistent timing preferred. Dose as directed by physician.",
    isChronic: true,
    habitForming: false,
    requiresRefrigeration: false,
    isNarcotic: false,
    tags: ["rx_required", "schedule_h", "chronic"],
    batches: [
      { lotNumber: "LOT-ATORVA-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 68, purchasePrice: 30, supplier: "Zydus Lifesciences", grnNumber: "GRN-SM-202409-004", qty: 40 },
      { lotNumber: "LOT-ATORVA-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 68, purchasePrice: 30, supplier: "Zydus Lifesciences", grnNumber: "GRN-SM-202503-004", qty: 35 },
      { lotNumber: "LOT-ATORVA-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 68, purchasePrice: 30, supplier: "Zydus Lifesciences", grnNumber: "GRN-SM-202509-004", qty: 25 },
    ],
  },
  {
    brandName: "Pan 40",
    genericName: "Pantoprazole",
    composition: "Pantoprazole Sodium Sesquihydrate equivalent to Pantoprazole 40mg",
    strength: "40mg",
    dosageForm: "tablet",
    packSize: "15 tablets",
    unitType: "strip",
    schedule: "H",
    therapeuticClass: "Proton Pump Inhibitor",
    categoryHandle: "gastroenterology",
    collectionTitle: "Gastro",
    sellingPrice: 49,
    mrp: 72,
    gstRate: 5,
    hsnCode: "30049099",
    manufacturer: "Alkem Laboratories",
    manufacturerLicense: "MH/DL/123/2008",
    description:
      "Pan 40 (Pantoprazole 40mg) by Alkem — proton pump inhibitor for GERD and peptic ulcer treatment and prevention.",
    indications:
      "GERD; Peptic ulcer disease; Zollinger-Ellison syndrome; NSAID-induced ulcer prophylaxis",
    contraindications:
      "Hypersensitivity to substituted benzimidazoles; Co-administration with rilpivirine",
    sideEffects:
      "Headache; Diarrhoea; Nausea; Hypomagnesaemia on long-term use; Bone fracture risk on prolonged use",
    storageInstructions:
      "Store below 30°C in dry place. Keep away from moisture. Do not remove from blister until use.",
    dosageInstructions:
      "One tablet once daily 30 minutes before breakfast. Swallow whole — do not crush or chew. Duration as directed by physician.",
    isChronic: false,
    habitForming: false,
    requiresRefrigeration: false,
    isNarcotic: false,
    tags: ["rx_required", "schedule_h"],
    batches: [
      { lotNumber: "LOT-PAN-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 72, purchasePrice: 32, supplier: "Alkem Laboratories", grnNumber: "GRN-SM-202409-005", qty: 40 },
      { lotNumber: "LOT-PAN-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 72, purchasePrice: 32, supplier: "Alkem Laboratories", grnNumber: "GRN-SM-202503-005", qty: 35 },
      { lotNumber: "LOT-PAN-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 72, purchasePrice: 32, supplier: "Alkem Laboratories", grnNumber: "GRN-SM-202509-005", qty: 25 },
    ],
  },
  {
    brandName: "Azithral 500",
    genericName: "Azithromycin",
    composition: "Azithromycin 500mg",
    strength: "500mg",
    dosageForm: "tablet",
    packSize: "3 tablets",
    unitType: "strip",
    schedule: "H",
    therapeuticClass: "Antibiotic (Macrolide)",
    categoryHandle: "antibiotics",
    collectionTitle: "Antibiotics",
    sellingPrice: 65,
    mrp: 95,
    gstRate: 5,
    hsnCode: "30042000",
    manufacturer: "Alembic Pharmaceuticals",
    manufacturerLicense: "GJ/DL/89/2003",
    description:
      "Azithral 500 (Azithromycin 500mg) by Alembic — macrolide antibiotic for respiratory tract and skin infections.",
    indications:
      "Community-acquired pneumonia; Pharyngitis; Sinusitis; Typhoid fever; Skin and soft-tissue infections; Atypical pneumonia",
    contraindications:
      "Hypersensitivity to azithromycin or any macrolide; QT prolongation; Hepatic disease; Co-administration with ergotamine",
    sideEffects:
      "Diarrhoea; Nausea; Abdominal pain; QT prolongation (rare); Hepatotoxicity (rare); Clostridium difficile colitis",
    storageInstructions:
      "Store below 30°C in dry place away from moisture and sunlight",
    dosageInstructions:
      "One tablet (500mg) once daily for 3 consecutive days. Complete the full course. Do not skip doses.",
    isChronic: false,
    habitForming: false,
    requiresRefrigeration: false,
    isNarcotic: false,
    tags: ["rx_required", "schedule_h"],
    batches: [
      { lotNumber: "LOT-AZIO-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 95, purchasePrice: 42, supplier: "Alembic Pharmaceuticals", grnNumber: "GRN-SM-202409-006", qty: 40 },
      { lotNumber: "LOT-AZIO-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 95, purchasePrice: 42, supplier: "Alembic Pharmaceuticals", grnNumber: "GRN-SM-202503-006", qty: 35 },
      { lotNumber: "LOT-AZIO-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 95, purchasePrice: 42, supplier: "Alembic Pharmaceuticals", grnNumber: "GRN-SM-202509-006", qty: 25 },
    ],
  },
  {
    brandName: "Cetzine 10",
    genericName: "Cetirizine",
    composition: "Cetirizine Hydrochloride 10mg",
    strength: "10mg",
    dosageForm: "tablet",
    packSize: "10 tablets",
    unitType: "strip",
    schedule: "OTC",
    therapeuticClass: "Antihistamine",
    categoryHandle: "general-medicines",
    collectionTitle: "Pain & Fever",
    sellingPrice: 19,
    mrp: 28,
    gstRate: 5,
    hsnCode: "30049099",
    manufacturer: "Dr. Reddy's Laboratories",
    manufacturerLicense: "AP/DL/87/2001",
    description:
      "Cetzine 10 (Cetirizine HCl 10mg) by Dr. Reddy's — second-generation antihistamine for allergic rhinitis and urticaria.",
    indications:
      "Allergic rhinitis (seasonal and perennial); Urticaria; Hay fever; Allergic conjunctivitis; Pruritus",
    contraindications:
      "Severe renal impairment (CrCl below 10 mL/min); Hypersensitivity to cetirizine or hydroxyzine",
    sideEffects: "Drowsiness; Dry mouth; Fatigue; Headache; Dizziness",
    storageInstructions:
      "Store below 30°C in dry place away from sunlight and moisture",
    dosageInstructions:
      "One tablet (10mg) once daily. May be taken with or without food. Avoid driving or operating machinery if drowsy.",
    isChronic: false,
    habitForming: false,
    requiresRefrigeration: false,
    isNarcotic: false,
    tags: ["otc"],
    batches: [
      { lotNumber: "LOT-CET-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 28, purchasePrice: 12, supplier: "Dr. Reddy's Laboratories", grnNumber: "GRN-SM-202409-007", qty: 40 },
      { lotNumber: "LOT-CET-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 28, purchasePrice: 12, supplier: "Dr. Reddy's Laboratories", grnNumber: "GRN-SM-202503-007", qty: 35 },
      { lotNumber: "LOT-CET-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 28, purchasePrice: 12, supplier: "Dr. Reddy's Laboratories", grnNumber: "GRN-SM-202509-007", qty: 25 },
    ],
  },
  {
    brandName: "Amlong 5",
    genericName: "Amlodipine",
    composition: "Amlodipine Besylate equivalent to Amlodipine 5mg",
    strength: "5mg",
    dosageForm: "tablet",
    packSize: "14 tablets",
    unitType: "strip",
    schedule: "H",
    therapeuticClass: "Antihypertensive (CCB)",
    categoryHandle: "hypertension",
    collectionTitle: "Cardiology",
    sellingPrice: 37,
    mrp: 55,
    gstRate: 5,
    hsnCode: "30049099",
    manufacturer: "Micro Labs Ltd",
    manufacturerLicense: "KTK/25/078/2007",
    description:
      "Amlong 5 (Amlodipine 5mg) by Micro Labs — calcium channel blocker for hypertension and stable angina.",
    indications:
      "Hypertension; Stable angina; Vasospastic angina (Prinzmetal angina)",
    contraindications:
      "Severe aortic stenosis; Cardiogenic shock; Hypersensitivity to amlodipine or dihydropyridines; Haemodynamically unstable heart failure",
    sideEffects:
      "Peripheral oedema (feet/ankles); Headache; Dizziness; Flushing; Palpitations",
    storageInstructions: "Store below 30°C in dry place away from moisture",
    dosageInstructions:
      "One tablet once daily at a consistent time. Dose adjustment as directed by physician. Do not abruptly discontinue.",
    isChronic: true,
    habitForming: false,
    requiresRefrigeration: false,
    isNarcotic: false,
    tags: ["rx_required", "schedule_h", "chronic"],
    batches: [
      { lotNumber: "LOT-AML-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 55, purchasePrice: 24, supplier: "Micro Labs Ltd", grnNumber: "GRN-SM-202409-008", qty: 40 },
      { lotNumber: "LOT-AML-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 55, purchasePrice: 24, supplier: "Micro Labs Ltd", grnNumber: "GRN-SM-202503-008", qty: 35 },
      { lotNumber: "LOT-AML-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 55, purchasePrice: 24, supplier: "Micro Labs Ltd", grnNumber: "GRN-SM-202509-008", qty: 25 },
    ],
  },
  {
    brandName: "Calcirol D3 60000",
    genericName: "Cholecalciferol",
    composition: "Cholecalciferol (Vitamin D3) 60000 IU",
    strength: "60000 IU",
    dosageForm: "capsule",
    packSize: "4 capsules",
    unitType: "strip",
    schedule: "OTC",
    therapeuticClass: "Vitamin / Bone Health",
    categoryHandle: "vitamins-supplements",
    collectionTitle: "Vitamins",
    sellingPrice: 122,
    mrp: 180,
    gstRate: 5,
    hsnCode: "30049099",
    manufacturer: "Cadila Pharmaceuticals",
    manufacturerLicense: "GJ/DL/67/2000",
    description:
      "Calcirol D3 60000 (Cholecalciferol 60000 IU) by Cadila — weekly Vitamin D3 supplement for deficiency treatment and bone health.",
    indications:
      "Vitamin D deficiency; Osteomalacia; Rickets; Osteoporosis prevention; Secondary hyperparathyroidism due to Vitamin D deficiency",
    contraindications:
      "Hypercalcaemia; Hypervitaminosis D; Hypercalciuria with risk of nephrolithiasis; Sarcoidosis",
    sideEffects:
      "Nausea; Weakness; Polyuria; Constipation (at high doses); Hypercalcaemia signs on toxicity",
    storageInstructions:
      "Store below 25°C in dry place away from direct sunlight. Keep in original sealed blister.",
    dosageInstructions:
      "One capsule (60000 IU) once weekly for 8-12 weeks. Maintenance one capsule monthly thereafter. As directed by physician.",
    isChronic: false,
    habitForming: false,
    requiresRefrigeration: false,
    isNarcotic: false,
    tags: ["otc"],
    batches: [
      { lotNumber: "LOT-CALC-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 180, purchasePrice: 79, supplier: "Cadila Pharmaceuticals", grnNumber: "GRN-SM-202409-009", qty: 40 },
      { lotNumber: "LOT-CALC-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 180, purchasePrice: 79, supplier: "Cadila Pharmaceuticals", grnNumber: "GRN-SM-202503-009", qty: 35 },
      { lotNumber: "LOT-CALC-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 180, purchasePrice: 79, supplier: "Cadila Pharmaceuticals", grnNumber: "GRN-SM-202509-009", qty: 25 },
    ],
  },
  {
    brandName: "Omez 20",
    genericName: "Omeprazole",
    composition: "Omeprazole 20mg",
    strength: "20mg",
    dosageForm: "capsule",
    packSize: "10 capsules",
    unitType: "strip",
    schedule: "H",
    therapeuticClass: "Proton Pump Inhibitor",
    categoryHandle: "gastroenterology",
    collectionTitle: "Gastro",
    sellingPrice: 26,
    mrp: 38,
    gstRate: 5,
    hsnCode: "30049099",
    manufacturer: "Dr. Reddy's Laboratories",
    manufacturerLicense: "AP/DL/87/2001",
    description:
      "Omez 20 (Omeprazole 20mg) by Dr. Reddy's — proton pump inhibitor for peptic ulcer and acid-related gastric disorders.",
    indications:
      "Peptic ulcer disease; GERD; H. pylori eradication (as part of combination therapy); Zollinger-Ellison syndrome",
    contraindications:
      "Hypersensitivity to omeprazole or substituted benzimidazoles; Co-administration with rilpivirine; Severe hypomagnesaemia",
    sideEffects:
      "Headache; Diarrhoea; Nausea; Hypomagnesaemia on prolonged use; Clostridium difficile infection (rare)",
    storageInstructions:
      "Store below 30°C in dry place away from moisture and heat. Keep in original pack.",
    dosageInstructions:
      "One capsule once daily 30 minutes before meals. Swallow whole — do not crush. Duration of therapy as directed by physician.",
    isChronic: false,
    habitForming: false,
    requiresRefrigeration: false,
    isNarcotic: false,
    tags: ["rx_required", "schedule_h"],
    batches: [
      { lotNumber: "LOT-OMEZ-2024-A", expiryDate: "2026-09-30", manufacturedOn: "2024-09-01", mrp: 38, purchasePrice: 17, supplier: "Dr. Reddy's Laboratories", grnNumber: "GRN-SM-202409-010", qty: 40 },
      { lotNumber: "LOT-OMEZ-2025-B", expiryDate: "2027-03-31", manufacturedOn: "2025-03-01", mrp: 38, purchasePrice: 17, supplier: "Dr. Reddy's Laboratories", grnNumber: "GRN-SM-202503-010", qty: 35 },
      { lotNumber: "LOT-OMEZ-2025-C", expiryDate: "2027-09-30", manufacturedOn: "2025-09-01", mrp: 38, purchasePrice: 17, supplier: "Dr. Reddy's Laboratories", grnNumber: "GRN-SM-202509-010", qty: 25 },
    ],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function makeSku(handle: string): string {
  return `SUPRA-${handle.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 48)
}

// ── Main ───────────────────────────────────────────────────────────────────

export default async function seedTestProducts({
  container,
}: {
  container: MedusaContainer
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const pharmaService = container.resolve(PHARMA_MODULE) as any
  const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
  const fulfillmentService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  ) as any
  const salesChannelService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  ) as any

  // ── Resolve prerequisites ────────────────────────────────────────────

  const [defaultSalesChannel] = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel?.id) {
    logger.error(
      "005-test-products: Default Sales Channel not found — run 001-infra-seed first."
    )
    return
  }

  const [shippingProfile] = await fulfillmentService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfile?.id) {
    logger.error(
      "005-test-products: Default shipping profile not found — run 001-infra-seed first."
    )
    return
  }

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = (stockLocations as any[])?.[0]
  if (!stockLocation?.id) {
    logger.error(
      "005-test-products: No stock location found — run 001-infra-seed first."
    )
    return
  }

  // Lookup maps
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  })
  const existingByHandle = new Map<string, string>(
    (existingProducts as any[]).map((p) => [p.handle, p.id])
  )

  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  })
  const categoryByHandle = new Map<string, any>(
    (existingCategories as any[]).map((c) => [c.handle, c])
  )

  const { data: existingCollections } = await query.graph({
    entity: "product_collection",
    fields: ["id", "title", "handle"],
  })
  const collectionByTitle = new Map<string, any>(
    (existingCollections as any[]).map((c) => [c.title, c])
  )

  const existingDrugs = await pharmaService.listDrugProducts({})
  const drugByProductId = new Map<string, any>(
    existingDrugs.map((d: any) => [d.product_id, d])
  )

  let created = 0
  let skipped = 0
  let errors = 0

  // ── Process each product ─────────────────────────────────────────────

  for (const product of TEST_PRODUCTS) {
    const handle = slugify(product.brandName)
    const sku = makeSku(handle)

    try {
      if (existingByHandle.has(handle)) {
        // Product already exists — ensure missing batches are added
        const productId = existingByHandle.get(handle)!
        await ensureBatches(
          container,
          query,
          batchService,
          product,
          productId,
          stockLocation
        )
        logger.info(`005-test-products: SKIP (exists): ${product.brandName}`)
        skipped++
        continue
      }

      const category = categoryByHandle.get(product.categoryHandle) ?? null
      const collection = collectionByTitle.get(product.collectionTitle) ?? null

      // ── Create Medusa product ──────────────────────────────────────

      const { result: createdProducts } = await createProductsWorkflow(
        container
      ).run({
        input: {
          products: [
            {
              title: product.brandName,
              handle,
              description: product.description,
              status: "published",
              sales_channels: [{ id: defaultSalesChannel.id }],
              collection_id: collection?.id ?? null,
              options: [{ title: "Pack", values: ["default"] }],
              variants: [
                {
                  title: product.brandName,
                  sku,
                  options: { Pack: "default" },
                  prices: [
                    { currency_code: "inr", amount: product.sellingPrice },
                  ],
                  manage_inventory: true,
                  allow_backorder: false,
                },
              ],
              shipping_profile_id: shippingProfile.id,
              metadata: {
                source: "seed:005-test-products",
                pharma: true,
                manufacturer: product.manufacturer,
              },
            },
          ],
        },
      })

      const createdProduct = (createdProducts as any[])[0]
      if (!createdProduct?.id) {
        logger.error(
          `005-test-products: Failed to create product: ${product.brandName}`
        )
        errors++
        continue
      }

      existingByHandle.set(handle, createdProduct.id)

      // ── Get the variant ────────────────────────────────────────────

      const { data: variants } = await query.graph({
        entity: "variant",
        fields: ["id", "sku", "product_id"],
        filters: { product_id: [createdProduct.id] },
      })
      const variant = (variants as any[])[0]

      // ── Find inventory item + set stock level ─────────────────────
      // createProductsWorkflow auto-creates inventory items when
      // manage_inventory=true, so we find it instead of creating again.

      if (variant?.id) {
        const totalQty = product.batches.reduce((sum, b) => sum + b.qty, 0)
        let invItemId: string | null = null

        // 1. Check variant link (most common path)
        try {
          const { data: variantWithInv } = await query.graph({
            entity: "variant",
            fields: ["id", "inventory_items.id"],
            filters: { id: [variant.id] },
          })
          invItemId =
            (variantWithInv as any[])[0]?.inventory_items?.[0]?.id ?? null
        } catch {
          /* not linked yet */
        }

        // 2. Fallback: find by SKU
        if (!invItemId) {
          try {
            const { data: invBySku } = await query.graph({
              entity: "inventory_item",
              fields: ["id"],
              filters: { sku: [sku] },
            })
            invItemId = (invBySku as any[])[0]?.id ?? null
          } catch {
            /* not found */
          }
        }

        // 3. Last resort: create manually
        if (!invItemId) {
          try {
            const { result: newItems } = await createInventoryItemsWorkflow(
              container
            ).run({ input: { items: [{ sku }] as any } })
            invItemId = (newItems as any[])[0]?.id ?? null
            if (invItemId) {
              await link.create({
                ["product" as any]: { variant_id: variant.id },
                ["inventory" as any]: { inventory_item_id: invItemId },
              })
            }
          } catch (e: any) {
            logger.warn(
              `005-test-products: inv item fallback failed for ${sku}: ${e.message}`
            )
          }
        }

        // Set stock level (total across all batches)
        if (invItemId) {
          try {
            await batchInventoryItemLevelsWorkflow(container).run({
              input: {
                creates: [
                  {
                    inventory_item_id: invItemId,
                    location_id: stockLocation.id,
                    stocked_quantity: totalQty,
                  },
                ],
                updates: [],
                deletes: [],
              } as any,
            })
          } catch {
            // Level already exists — update instead
            await batchInventoryItemLevelsWorkflow(container).run({
              input: {
                creates: [],
                updates: [
                  {
                    inventory_item_id: invItemId,
                    location_id: stockLocation.id,
                    stocked_quantity: totalQty,
                  },
                ],
                deletes: [],
              } as any,
            })
          }
        }
      }

      // ── Link product to category ───────────────────────────────────

      if (category?.id) {
        await batchLinkProductsToCategoryWorkflow(container).run({
          input: {
            id: category.id,
            add: [createdProduct.id],
            remove: [],
          },
        })
      }

      // ── Create drug metadata ───────────────────────────────────────

      await pharmaService.createDrugProducts({
        product_id: createdProduct.id,
        schedule: product.schedule,
        generic_name: product.genericName,
        therapeutic_class: product.therapeuticClass,
        dosage_form: product.dosageForm,
        strength: product.strength,
        composition: product.composition,
        pack_size: product.packSize,
        unit_type: product.unitType,
        mrp_paise: product.mrp * 100,
        gst_rate: product.gstRate,
        hsn_code: product.hsnCode,
        manufacturer_license: product.manufacturerLicense,
        indications: product.indications,
        contraindications: product.contraindications,
        side_effects: product.sideEffects,
        storage_instructions: product.storageInstructions,
        dosage_instructions: product.dosageInstructions,
        requires_refrigeration: product.requiresRefrigeration,
        is_narcotic: product.isNarcotic,
        habit_forming: product.habitForming,
        is_chronic: product.isChronic,
        metadata: {
          source: "seed:005-test-products",
          manufacturer: product.manufacturer,
        },
      })

      drugByProductId.set(createdProduct.id, true)

      // ── Create all 3 batches (stock level already set above) ──────

      if (variant?.id) {
        for (const batch of product.batches) {
          await batchService.createBatches({
            product_variant_id: variant.id,
            product_id: createdProduct.id,
            lot_number: batch.lotNumber,
            manufactured_on: batch.manufacturedOn,
            expiry_date: batch.expiryDate,
            received_quantity: batch.qty,
            available_quantity: batch.qty,
            reserved_quantity: 0,
            batch_mrp_paise: batch.mrp * 100,
            purchase_price_paise: batch.purchasePrice * 100,
            location_id: stockLocation.id,
            supplier_name: batch.supplier,
            grn_number: batch.grnNumber,
            received_on: new Date().toISOString(),
            status: "active",
            metadata: { source: "seed:005-test-products" },
          })
          logger.info(
            `005-test-products:   ↳ Batch ${batch.lotNumber} (exp: ${batch.expiryDate}, qty: ${batch.qty})`
          )
        }
      }

      logger.info(
        `005-test-products: CREATED: ${product.brandName} (100 units / 3 batches)`
      )
      created++
    } catch (err: any) {
      logger.error(
        `005-test-products: ERROR (${product.brandName}): ${err.message}`
      )
      errors++
    }
  }

  logger.info(
    `005-test-products: done. Created: ${created}, skipped: ${skipped}, errors: ${errors}`
  )
}

// ── ensureBatches: add any missing batches to an already-existing product ──

async function ensureBatches(
  container: MedusaContainer,
  query: any,
  batchService: any,
  product: ProductSeed,
  productId: string,
  stockLocation: { id: string }
): Promise<void> {
  const { data: variantData } = await query.graph({
    entity: "variant",
    fields: [
      "id",
      "inventory_items.id",
      "inventory_items.location_levels.stocked_quantity",
      "inventory_items.location_levels.location_id",
    ],
    filters: { product_id: [productId] },
  })
  const variant = (variantData as any[])[0]
  const invItem = variant?.inventory_items?.[0]
  if (!variant?.id) return

  for (const batch of product.batches) {
    try {
      const existing = await batchService.listBatches({
        lot_number: batch.lotNumber,
      })
      if (existing.length) continue

      await batchService.createBatches({
        product_variant_id: variant.id,
        product_id: productId,
        lot_number: batch.lotNumber,
        manufactured_on: batch.manufacturedOn,
        expiry_date: batch.expiryDate,
        received_quantity: batch.qty,
        available_quantity: batch.qty,
        reserved_quantity: 0,
        batch_mrp_paise: batch.mrp * 100,
        purchase_price_paise: batch.purchasePrice * 100,
        location_id: stockLocation.id,
        supplier_name: batch.supplier,
        grn_number: batch.grnNumber,
        received_on: new Date().toISOString(),
        status: "active",
        metadata: { source: "seed:005-test-products" },
      })

      if (batch.qty > 0 && invItem?.id) {
        const currentLevel = invItem.location_levels?.find(
          (l: any) => l.location_id === stockLocation.id
        )
        const currentQty = currentLevel?.stocked_quantity ?? 0

        try {
          // Try update first (level exists)
          await batchInventoryItemLevelsWorkflow(container).run({
            input: {
              creates: [],
              updates: [
                {
                  inventory_item_id: invItem.id,
                  location_id: stockLocation.id,
                  stocked_quantity: currentQty + batch.qty,
                },
              ],
              deletes: [],
            } as any,
          })
        } catch {
          // Level doesn't exist yet (0 locations) — create it
          await batchInventoryItemLevelsWorkflow(container).run({
            input: {
              creates: [
                {
                  inventory_item_id: invItem.id,
                  location_id: stockLocation.id,
                  stocked_quantity: batch.qty,
                },
              ],
              updates: [],
              deletes: [],
            } as any,
          })
        }

        // Update cached level for next iteration
        if (currentLevel) {
          currentLevel.stocked_quantity = currentQty + batch.qty
        } else {
          invItem.location_levels = [
            ...(invItem.location_levels || []),
            {
              location_id: stockLocation.id,
              stocked_quantity: batch.qty,
            },
          ]
        }
      }
    } catch (err: any) {
      const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
      logger.warn(
        `005-test-products:   batch ${batch.lotNumber} ensure failed: ${err.message}`
      )
    }
  }
}
