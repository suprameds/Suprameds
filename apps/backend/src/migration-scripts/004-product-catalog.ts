/**
 * 004 — Consolidated Product Catalog Seed
 *
 * Seeds ~52 generic medicines across 8 therapeutic categories with:
 *   - Full product + variant data via createProductsWorkflow
 *   - Pharma drug metadata (schedule, clinical info, composition)
 *   - Inventory items, levels, and variant→inventory links
 *   - 2 pharma batches per variant for FEFO allocation testing
 *
 * Idempotent: deletes products with metadata.source = "suprameds-seed"
 * before recreating. Safe to run multiple times.
 *
 * Run: npx medusa exec ./src/scripts/run-migrations.ts
 */
import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import {
  batchInventoryItemLevelsWorkflow,
  createInventoryItemsWorkflow,
  createProductsWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { PHARMA_MODULE } from "../modules/pharma"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:004-product-catalog")

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type DrugSchedule = "OTC" | "H" | "H1"

type DosageForm =
  | "tablet"
  | "capsule"
  | "syrup"
  | "suspension"
  | "cream"
  | "drops"
  | "injection"
  | "inhaler"
  | "patch"
  | "other"

type ProductDef = {
  title: string
  generic_name: string
  brand_name: string
  manufacturer: string
  drug_schedule: DrugSchedule
  dosage_form: DosageForm
  strength: string
  pack_size: string
  composition: string
  therapeutic_category: string
  /** MRP in whole rupees */
  price: number
  requires_prescription: boolean
  storage_conditions: string
  indications: string
  contraindications: string
  side_effects: string
  drug_interactions: string
  dosage_instructions: string
  is_chronic: boolean
  habit_forming: boolean
  description: string
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function makeSku(title: string): string {
  return `SM-${title.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 48)
}

function monthsFromNow(months: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d
}

function monthsAgo(months: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d
}

// ────────────────────────────────────────────────────────────────────────────
// Product Definitions — 52 real Indian generic medicines
// ────────────────────────────────────────────────────────────────────────────

const PRODUCTS: ProductDef[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  //  DIABETES (8 products)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Metformin 500mg Tablets",
    generic_name: "Metformin Hydrochloride",
    brand_name: "Glycomet 500",
    manufacturer: "USV Private Limited",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "500mg",
    pack_size: "10 tablets",
    composition: "Metformin Hydrochloride IP 500mg",
    therapeutic_category: "Diabetes",
    price: 35,
    requires_prescription: false,
    storage_conditions: "Store below 30°C in a dry place, protected from light and moisture.",
    indications:
      "Type 2 diabetes mellitus as monotherapy when diet and exercise alone do not provide adequate glycaemic control, or in combination with other oral antidiabetic agents or insulin.",
    contraindications:
      "Diabetic ketoacidosis, severe renal impairment (eGFR < 30 mL/min), acute conditions with risk of tissue hypoxia (cardiac or respiratory failure, recent myocardial infarction), hepatic insufficiency, acute alcohol intoxication, lactic acidosis.",
    side_effects:
      "Common: nausea, vomiting, diarrhoea, abdominal pain, loss of appetite, metallic taste. Rare: lactic acidosis (seek emergency care if unexplained muscle pain, breathing difficulty, or unusual fatigue occur). Long-term use may cause vitamin B12 deficiency.",
    drug_interactions:
      "Alcohol increases lactic acidosis risk. Discontinue 48 hours before and after iodinated contrast media procedures. Cimetidine may increase metformin levels. ACE inhibitors may enhance hypoglycaemic effect.",
    dosage_instructions:
      "Take with or after meals. Usual starting dose: 500mg twice daily. Maximum: 2550mg/day in divided doses. Dose adjustments based on blood glucose monitoring.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Metformin is the first-line treatment for type 2 diabetes. It works by reducing hepatic glucose production, decreasing intestinal absorption of glucose, and improving insulin sensitivity. The sustained-release formulation minimises gastrointestinal side effects common with immediate-release metformin.",
  },
  {
    title: "Metformin 1000mg SR Tablets",
    generic_name: "Metformin Hydrochloride",
    brand_name: "Glycomet SR 1000",
    manufacturer: "USV Private Limited",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "1000mg",
    pack_size: "10 tablets",
    composition: "Metformin Hydrochloride IP 1000mg (Sustained Release)",
    therapeutic_category: "Diabetes",
    price: 65,
    requires_prescription: false,
    storage_conditions: "Store below 30°C in a dry place, protected from light and moisture.",
    indications:
      "Type 2 diabetes mellitus when higher doses are required for adequate glycaemic control. Particularly suitable for patients already stabilised on immediate-release metformin who need dose optimisation.",
    contraindications:
      "Diabetic ketoacidosis, severe renal impairment (eGFR < 30 mL/min), conditions predisposing to lactic acidosis, hepatic insufficiency, acute alcohol intoxication, pregnancy.",
    side_effects:
      "Common: nausea, diarrhoea, abdominal discomfort (less frequent with SR formulation than immediate release). Uncommon: metallic taste, reduced vitamin B12 absorption. Rare: lactic acidosis.",
    drug_interactions:
      "Alcohol potentiates lactic acidosis risk. Iodinated contrast agents — withhold metformin 48 hrs before and after. Cimetidine elevates plasma metformin. Corticosteroids may reduce efficacy.",
    dosage_instructions:
      "Take with dinner or the largest meal. Swallow whole; do not crush or chew SR tablet. Usual dose: 1000mg once daily. Maximum: 2000mg/day.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Metformin 1000mg sustained-release tablets provide extended glycaemic control with once-daily dosing. The SR formulation reduces gastrointestinal adverse effects compared to immediate-release metformin by allowing gradual absorption in the intestine.",
  },
  {
    title: "Glimepiride 1mg Tablets",
    generic_name: "Glimepiride",
    brand_name: "Amaryl 1",
    manufacturer: "Sanofi India Limited",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "1mg",
    pack_size: "10 tablets",
    composition: "Glimepiride IP 1mg",
    therapeutic_category: "Diabetes",
    price: 45,
    requires_prescription: true,
    storage_conditions: "Store below 25°C, protected from moisture and light. Keep out of reach of children.",
    indications:
      "Type 2 diabetes mellitus as monotherapy or in combination with metformin when diet, exercise, and metformin alone are insufficient for glycaemic control.",
    contraindications:
      "Type 1 diabetes, diabetic ketoacidosis, severe hepatic or renal impairment, known hypersensitivity to sulphonylureas or sulphonamides, pregnancy and lactation.",
    side_effects:
      "Common: hypoglycaemia (especially with missed meals or excessive exercise), weight gain, nausea. Uncommon: dizziness, headache, visual disturbances. Rare: leucopenia, thrombocytopenia, hepatitis, allergic skin reactions.",
    drug_interactions:
      "NSAIDs, sulphonamides, and fluconazole may potentiate hypoglycaemic effect. Beta-blockers may mask hypoglycaemia symptoms. Corticosteroids and thiazide diuretics may reduce efficacy.",
    dosage_instructions:
      "Take immediately before or with first main meal. Starting dose: 1mg once daily. Titrate in 1mg increments at 1-2 week intervals based on blood glucose response. Maximum: 6mg/day.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Glimepiride is a third-generation sulphonylurea that stimulates insulin release from pancreatic beta cells and improves peripheral insulin sensitivity. It has a lower incidence of hypoglycaemia compared to older sulphonylureas like glibenclamide.",
  },
  {
    title: "Glimepiride 2mg Tablets",
    generic_name: "Glimepiride",
    brand_name: "Amaryl 2",
    manufacturer: "Sanofi India Limited",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "2mg",
    pack_size: "10 tablets",
    composition: "Glimepiride IP 2mg",
    therapeutic_category: "Diabetes",
    price: 75,
    requires_prescription: true,
    storage_conditions: "Store below 25°C, protected from moisture and light.",
    indications:
      "Type 2 diabetes mellitus in patients requiring higher sulphonylurea doses for glycaemic control, as monotherapy or in combination with metformin or insulin.",
    contraindications:
      "Type 1 diabetes, diabetic ketoacidosis, severe renal or hepatic impairment, hypersensitivity to sulphonylureas, pregnancy and breastfeeding.",
    side_effects:
      "Common: hypoglycaemia, weight gain, GI disturbances. Uncommon: dizziness, visual changes, skin rash. Rare: blood dyscrasias, cholestatic jaundice.",
    drug_interactions:
      "Fluconazole, miconazole, and clarithromycin may increase hypoglycaemia risk. Rifampicin may reduce glimepiride levels. Alcohol potentiates hypoglycaemia.",
    dosage_instructions:
      "Take with first main meal of the day. Titrate from 1mg upward in 1mg steps. Maximum recommended dose: 6mg/day.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Glimepiride 2mg provides enhanced insulin secretion stimulation for patients with type 2 diabetes requiring dose escalation beyond 1mg. It binds to the 65-kDa subunit of the sulphonylurea receptor on pancreatic beta cells.",
  },
  {
    title: "Sitagliptin 100mg Tablets",
    generic_name: "Sitagliptin Phosphate",
    brand_name: "Istavel 100",
    manufacturer: "Sun Pharmaceutical Industries",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "100mg",
    pack_size: "10 tablets",
    composition: "Sitagliptin Phosphate Monohydrate equivalent to Sitagliptin 100mg",
    therapeutic_category: "Diabetes",
    price: 85,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture.",
    indications:
      "Type 2 diabetes mellitus as monotherapy or add-on to metformin, sulphonylurea, or insulin when these alone with diet and exercise do not provide adequate glycaemic control.",
    contraindications:
      "Type 1 diabetes, diabetic ketoacidosis, history of pancreatitis, severe renal impairment (eGFR < 30 mL/min without dose adjustment), hypersensitivity to sitagliptin.",
    side_effects:
      "Common: nasopharyngitis, upper respiratory tract infection, headache. Uncommon: constipation, peripheral oedema, joint pain. Rare: pancreatitis (discontinue if persistent severe abdominal pain occurs), angioedema, Stevens-Johnson syndrome.",
    drug_interactions:
      "Digoxin levels may be slightly increased. No significant CYP-mediated interactions. Dose adjustment required with strong CYP3A4 inhibitors in renal impairment.",
    dosage_instructions:
      "Take 100mg once daily with or without food. In moderate renal impairment (eGFR 30-44 mL/min): 50mg once daily. In severe renal impairment: 25mg once daily.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Sitagliptin is a DPP-4 inhibitor that enhances the body's incretin system. It prevents the breakdown of GLP-1 and GIP hormones, which stimulate insulin release and suppress glucagon secretion in a glucose-dependent manner, resulting in lower risk of hypoglycaemia.",
  },
  {
    title: "Voglibose 0.2mg Tablets",
    generic_name: "Voglibose",
    brand_name: "Volix 0.2",
    manufacturer: "Ranbaxy Laboratories",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "0.2mg",
    pack_size: "10 tablets",
    composition: "Voglibose IP 0.2mg",
    therapeutic_category: "Diabetes",
    price: 60,
    requires_prescription: true,
    storage_conditions: "Store below 30°C in a dry place, protected from light.",
    indications:
      "Type 2 diabetes mellitus — as adjunct to diet for reducing postprandial blood glucose, in combination with sulphonylureas or insulin when these alone are inadequate.",
    contraindications:
      "Diabetic ketoacidosis, severe diabetic coma, severe infections, surgical emergencies, inflammatory bowel disease, colonic ulceration, intestinal obstruction.",
    side_effects:
      "Common: flatulence, abdominal distension, diarrhoea, soft stools (due to undigested carbohydrates reaching the colon). Uncommon: nausea, elevated liver enzymes. Rare: fulminant hepatitis, intestinal pneumatosis.",
    drug_interactions:
      "May reduce absorption of digoxin and other drugs. Intestinal adsorbents and digestive enzyme preparations may reduce efficacy. Concurrent sulphonylureas may increase hypoglycaemia risk.",
    dosage_instructions:
      "Take immediately before each main meal. Starting dose: 0.2mg three times daily. May increase to 0.3mg three times daily based on response.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Voglibose is an alpha-glucosidase inhibitor that delays the digestion and absorption of carbohydrates in the small intestine, thereby reducing postprandial blood glucose spikes. It is particularly effective in the Asian diabetic population with carbohydrate-rich diets.",
  },
  {
    title: "Gliclazide 80mg Tablets",
    generic_name: "Gliclazide",
    brand_name: "Diamicron 80",
    manufacturer: "Serdia Pharmaceuticals",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "80mg",
    pack_size: "10 tablets",
    composition: "Gliclazide IP 80mg",
    therapeutic_category: "Diabetes",
    price: 55,
    requires_prescription: true,
    storage_conditions: "Store below 25°C, protected from moisture and direct sunlight.",
    indications:
      "Type 2 diabetes mellitus in adults when dietary measures, physical exercise, and weight reduction alone are not sufficient to control blood glucose.",
    contraindications:
      "Type 1 diabetes, diabetic ketoacidosis, diabetic precoma and coma, severe renal or hepatic insufficiency, known hypersensitivity to gliclazide or other sulphonylureas.",
    side_effects:
      "Common: hypoglycaemia (especially with irregular meals), GI disturbances. Uncommon: skin rash, pruritus, elevated liver enzymes. Rare: blood dyscrasias (anaemia, leucopenia, thrombocytopenia), hyponatraemia.",
    drug_interactions:
      "Miconazole is contraindicated (severe hypoglycaemia). Phenylbutazone, alcohol, and fluconazole potentiate hypoglycaemia. Danazol and chlorpromazine may reduce efficacy.",
    dosage_instructions:
      "Take with breakfast. Starting dose: 40-80mg/day. Titrate in 80mg increments. Maximum: 320mg/day in divided doses (twice daily if > 160mg).",
    is_chronic: true,
    habit_forming: false,
    description:
      "Gliclazide is a second-generation sulphonylurea that stimulates insulin secretion from functioning pancreatic beta cells. It also has beneficial haemovascular properties, reducing platelet adhesion and aggregation and restoring fibrinolytic activity.",
  },
  {
    title: "Pioglitazone 15mg Tablets",
    generic_name: "Pioglitazone Hydrochloride",
    brand_name: "Pioz 15",
    manufacturer: "USV Private Limited",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "15mg",
    pack_size: "10 tablets",
    composition: "Pioglitazone Hydrochloride IP equivalent to Pioglitazone 15mg",
    therapeutic_category: "Diabetes",
    price: 40,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture. Keep in original packaging.",
    indications:
      "Type 2 diabetes mellitus as monotherapy or in dual/triple combination with metformin and/or a sulphonylurea when diet and exercise plus monotherapy do not provide adequate glycaemic control.",
    contraindications:
      "Heart failure (NYHA class I-IV), active or history of bladder cancer, uninvestigated macroscopic haematuria, hepatic impairment (ALT > 2.5x ULN), diabetic ketoacidosis.",
    side_effects:
      "Common: weight gain, oedema, upper respiratory tract infection. Uncommon: anaemia, headache, visual disturbance, fractures (increased risk in women). Rare: hepatic dysfunction, macular oedema.",
    drug_interactions:
      "CYP2C8 inhibitors (gemfibrozil) increase pioglitazone exposure — reduce dose to 15mg. CYP2C8 inducers (rifampicin) may reduce efficacy. May reduce efficacy of oral contraceptives.",
    dosage_instructions:
      "Take once daily with or without food. Starting dose: 15mg once daily. May increase to 30mg or 45mg once daily based on glycaemic response.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Pioglitazone is a thiazolidinedione (PPARgamma agonist) that improves insulin sensitivity in muscle and adipose tissue and inhibits hepatic gluconeogenesis. It reduces insulin resistance, a fundamental defect in type 2 diabetes.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  HYPERTENSION (8 products)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Amlodipine 5mg Tablets",
    generic_name: "Amlodipine Besylate",
    brand_name: "Amlong 5",
    manufacturer: "Micro Labs Limited",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "5mg",
    pack_size: "10 tablets",
    composition: "Amlodipine Besylate IP equivalent to Amlodipine 5mg",
    therapeutic_category: "Hypertension",
    price: 30,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from light and moisture.",
    indications:
      "Hypertension (alone or in combination with other antihypertensives). Chronic stable angina pectoris. Vasospastic (Prinzmetal's) angina.",
    contraindications:
      "Known hypersensitivity to amlodipine or dihydropyridine derivatives. Severe aortic stenosis. Cardiogenic shock. Unstable angina (except Prinzmetal's).",
    side_effects:
      "Common: peripheral oedema (dose-related), headache, flushing, dizziness. Uncommon: fatigue, nausea, abdominal pain, palpitations. Rare: gynaecomastia, gingival hyperplasia, hepatitis, erythema multiforme.",
    drug_interactions:
      "Strong CYP3A4 inhibitors (ketoconazole, ritonavir) may increase amlodipine levels. Simvastatin dose should not exceed 20mg when combined. May enhance cyclosporine and tacrolimus levels.",
    dosage_instructions:
      "Take once daily at the same time each day. Starting dose: 5mg. Maximum: 10mg once daily. Elderly and hepatic impairment: start with 2.5mg.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Amlodipine is a long-acting dihydropyridine calcium channel blocker that relaxes vascular smooth muscle, reducing peripheral vascular resistance and lowering blood pressure. Its 30-50 hour half-life provides consistent 24-hour blood pressure control with once-daily dosing.",
  },
  {
    title: "Amlodipine 10mg Tablets",
    generic_name: "Amlodipine Besylate",
    brand_name: "Amlong 10",
    manufacturer: "Micro Labs Limited",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "10mg",
    pack_size: "10 tablets",
    composition: "Amlodipine Besylate IP equivalent to Amlodipine 10mg",
    therapeutic_category: "Hypertension",
    price: 50,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from light and moisture.",
    indications:
      "Hypertension not adequately controlled on 5mg amlodipine. Chronic stable and vasospastic angina.",
    contraindications:
      "Severe hypotension, cardiogenic shock, severe aortic stenosis, hypersensitivity to dihydropyridines.",
    side_effects:
      "Common: peripheral oedema (more frequent at 10mg), headache, flushing, dizziness, fatigue. Uncommon: palpitations, dyspnoea, muscle cramps. Rare: vasculitis, hyperglycaemia, hepatitis.",
    drug_interactions:
      "CYP3A4 inhibitors may increase amlodipine exposure. Simvastatin: limit to 20mg/day. Monitor cyclosporine and tacrolimus levels. Avoid grapefruit juice in large quantities.",
    dosage_instructions:
      "Take once daily. This is the maximum recommended dose. Do not exceed 10mg/day. Monitor for peripheral oedema.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Amlodipine 10mg is the maximum-strength formulation for patients requiring intensified calcium channel blocker therapy. Peripheral oedema is dose-dependent and occurs in approximately 10% of patients at this dose.",
  },
  {
    title: "Telmisartan 40mg Tablets",
    generic_name: "Telmisartan",
    brand_name: "Telma 40",
    manufacturer: "Glenmark Pharmaceuticals",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "40mg",
    pack_size: "10 tablets",
    composition: "Telmisartan IP 40mg",
    therapeutic_category: "Hypertension",
    price: 45,
    requires_prescription: true,
    storage_conditions: "Store below 30°C in original blister pack, protected from moisture.",
    indications:
      "Essential hypertension. Cardiovascular risk reduction in patients aged 55 years or older with established atherothrombotic cardiovascular disease or type 2 diabetes with target-organ damage.",
    contraindications:
      "Pregnancy (2nd and 3rd trimester), biliary obstruction, severe hepatic impairment, concomitant use with aliskiren in patients with diabetes or renal impairment.",
    side_effects:
      "Common: dizziness, back pain, sinusitis, diarrhoea. Uncommon: hypotension (especially in volume-depleted patients), hyperkalaemia, renal impairment, anaemia. Rare: angioedema, hepatic dysfunction.",
    drug_interactions:
      "Lithium levels may increase (monitor). NSAIDs may reduce antihypertensive effect and worsen renal function. Potassium supplements and potassium-sparing diuretics increase hyperkalaemia risk. Avoid dual RAAS blockade.",
    dosage_instructions:
      "Take once daily with or without food. Starting dose: 40mg/day. May increase to 80mg if needed. Take at the same time each day, preferably in the morning.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Telmisartan is a selective angiotensin II receptor blocker (ARB) with the longest half-life in its class (approximately 24 hours), providing consistent 24-hour blood pressure control. It also has partial PPARgamma agonist activity offering modest metabolic benefits.",
  },
  {
    title: "Telmisartan 80mg Tablets",
    generic_name: "Telmisartan",
    brand_name: "Telma 80",
    manufacturer: "Glenmark Pharmaceuticals",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "80mg",
    pack_size: "10 tablets",
    composition: "Telmisartan IP 80mg",
    therapeutic_category: "Hypertension",
    price: 80,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture. Keep in original packaging.",
    indications:
      "Hypertension not adequately controlled on 40mg telmisartan. Cardiovascular prevention in high-risk patients.",
    contraindications:
      "Pregnancy, severe hepatic impairment, biliary obstruction, concomitant aliskiren use in diabetes.",
    side_effects:
      "Common: dizziness, upper respiratory tract infection. Uncommon: hypotension, hyperkalaemia, elevated creatinine. Rare: angioedema, renal failure in susceptible patients.",
    drug_interactions:
      "Lithium (monitor levels), NSAIDs, potassium-sparing diuretics. Dual RAAS blockade is contraindicated.",
    dosage_instructions:
      "Take 80mg once daily. This is the maximum dose. Do not discontinue abruptly — taper if necessary.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Telmisartan 80mg is the maximum-strength ARB formulation providing robust RAAS blockade. Clinical trials (ONTARGET) demonstrated cardiovascular protective effects comparable to ACE inhibitors with better tolerability.",
  },
  {
    title: "Losartan 50mg Tablets",
    generic_name: "Losartan Potassium",
    brand_name: "Losar 50",
    manufacturer: "Cipla Limited",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "50mg",
    pack_size: "10 tablets",
    composition: "Losartan Potassium IP 50mg",
    therapeutic_category: "Hypertension",
    price: 40,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from light and moisture.",
    indications:
      "Hypertension. Diabetic nephropathy with proteinuria in patients with type 2 diabetes and hypertension. Heart failure when ACE inhibitors are not tolerated.",
    contraindications:
      "Pregnancy (especially 2nd and 3rd trimester), severe hepatic impairment, concomitant aliskiren in diabetic patients, hypersensitivity to losartan.",
    side_effects:
      "Common: dizziness, hypotension, hyperkalaemia. Uncommon: fatigue, anaemia, impaired renal function, cough (less frequent than ACE inhibitors). Rare: angioedema, rhabdomyolysis, hepatitis.",
    drug_interactions:
      "NSAIDs may reduce antihypertensive effect. Potassium supplements increase hyperkalaemia risk. Rifampicin and fluconazole alter losartan metabolism. Monitor lithium levels.",
    dosage_instructions:
      "Take once daily with or without food. Starting dose: 50mg. May increase to 100mg once daily. In hepatic impairment or volume depletion: start with 25mg.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Losartan was the first clinically available angiotensin II receptor blocker. It has demonstrated specific renoprotective effects in type 2 diabetic nephropathy (RENAAL trial) and also has a mild uricosuric effect that may benefit patients with gout.",
  },
  {
    title: "Ramipril 5mg Capsules",
    generic_name: "Ramipril",
    brand_name: "Cardace 5",
    manufacturer: "Sanofi India Limited",
    drug_schedule: "H",
    dosage_form: "capsule",
    strength: "5mg",
    pack_size: "10 capsules",
    composition: "Ramipril IP 5mg",
    therapeutic_category: "Hypertension",
    price: 55,
    requires_prescription: true,
    storage_conditions: "Store below 25°C, protected from moisture. Do not remove from blister until use.",
    indications:
      "Hypertension. Heart failure post-myocardial infarction. Diabetic or non-diabetic nephropathy. Cardiovascular prevention in high-risk patients (established cardiovascular disease or diabetes with at least one other risk factor).",
    contraindications:
      "History of angioedema (hereditary or ACE inhibitor-related), bilateral renal artery stenosis, pregnancy, concomitant aliskiren in diabetes, hyperkalaemia.",
    side_effects:
      "Common: dry cough (up to 10%), dizziness, headache, fatigue. Uncommon: hypotension (especially first dose), hyperkalaemia, renal impairment, skin rash. Rare: angioedema, neutropenia, pancreatitis.",
    drug_interactions:
      "NSAIDs reduce antihypertensive effect. Potassium-sparing diuretics and potassium supplements increase hyperkalaemia risk. Dual RAAS blockade contraindicated. Monitor lithium levels.",
    dosage_instructions:
      "Take once daily at the same time. Starting dose for hypertension: 1.25-2.5mg. Titrate over 2-4 weeks to 5-10mg/day. Maximum: 10mg/day.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Ramipril is a long-acting ACE inhibitor proven to reduce cardiovascular mortality in the landmark HOPE trial. It inhibits angiotensin-converting enzyme, reducing angiotensin II levels, lowering blood pressure, and providing cardio-renal protection.",
  },
  {
    title: "Atenolol 50mg Tablets",
    generic_name: "Atenolol",
    brand_name: "Aten 50",
    manufacturer: "Zydus Lifesciences",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "50mg",
    pack_size: "10 tablets",
    composition: "Atenolol IP 50mg",
    therapeutic_category: "Hypertension",
    price: 25,
    requires_prescription: true,
    storage_conditions: "Store below 25°C, protected from light and moisture.",
    indications:
      "Hypertension. Angina pectoris. Cardiac arrhythmias (supraventricular tachycardia). Early intervention within 12 hours of myocardial infarction.",
    contraindications:
      "Cardiogenic shock, uncompensated heart failure, sick sinus syndrome, second or third-degree heart block, severe bradycardia (HR < 45/min), untreated phaeochromocytoma, severe peripheral arterial disease.",
    side_effects:
      "Common: cold extremities, fatigue, bradycardia, GI disturbances. Uncommon: sleep disturbances, depression, bronchospasm (in susceptible patients). Rare: worsening of psoriasis, alopecia, dry eyes.",
    drug_interactions:
      "Verapamil and diltiazem may cause severe bradycardia (avoid combination). Clonidine discontinuation — stop atenolol first to avoid rebound hypertension. NSAIDs may reduce antihypertensive effect.",
    dosage_instructions:
      "Take once daily, preferably in the morning. Starting dose: 50mg/day. Maximum: 100mg/day. Do not stop abruptly — taper over 1-2 weeks to avoid rebound tachycardia.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Atenolol is a cardioselective beta-1 blocker that reduces heart rate, blood pressure, and myocardial oxygen demand. It is one of the most widely prescribed antihypertensives in India, with proven efficacy and a well-established safety profile over decades of use.",
  },
  {
    title: "Cilnidipine 10mg Tablets",
    generic_name: "Cilnidipine",
    brand_name: "Cilacar 10",
    manufacturer: "J B Chemicals & Pharmaceuticals",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "10mg",
    pack_size: "10 tablets",
    composition: "Cilnidipine 10mg",
    therapeutic_category: "Hypertension",
    price: 65,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from light and moisture.",
    indications:
      "Essential hypertension. Particularly suitable for hypertensive patients with renal disease, diabetes, or sympathetic overactivity.",
    contraindications:
      "Cardiogenic shock, severe aortic stenosis, unstable angina, known hypersensitivity, pregnancy and lactation.",
    side_effects:
      "Common: headache, dizziness, flushing. Uncommon: palpitations, peripheral oedema (less than amlodipine), GI disturbances. Rare: hepatic dysfunction.",
    drug_interactions:
      "CYP3A4 inhibitors may increase cilnidipine levels. Avoid grapefruit juice. Beta-blockers — monitor for excessive heart rate reduction. Cimetidine may increase bioavailability.",
    dosage_instructions:
      "Take once daily after breakfast. Starting dose: 5-10mg. Maximum: 20mg/day. Swallow whole with water.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Cilnidipine is a unique dual-action calcium channel blocker (L-type + N-type) that not only relaxes vascular smooth muscle but also inhibits sympathetic nerve terminal calcium channels. This results in less reflex tachycardia and less pedal oedema compared to amlodipine.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  CARDIAC CARE (6 products)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Atorvastatin 10mg Tablets",
    generic_name: "Atorvastatin Calcium",
    brand_name: "Atorva 10",
    manufacturer: "Zydus Lifesciences",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "10mg",
    pack_size: "10 tablets",
    composition: "Atorvastatin Calcium Trihydrate IP equivalent to Atorvastatin 10mg",
    therapeutic_category: "Cardiac Care",
    price: 45,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture and light.",
    indications:
      "Primary hypercholesterolaemia and mixed dyslipidaemia as adjunct to diet. Prevention of cardiovascular events in patients with multiple risk factors. Secondary prevention post-ACS.",
    contraindications:
      "Active liver disease or unexplained persistent elevations of serum transaminases (> 3x ULN), pregnancy, breastfeeding, concomitant cyclosporine.",
    side_effects:
      "Common: headache, GI disturbances, myalgia, nasopharyngitis. Uncommon: insomnia, dizziness, elevated liver enzymes. Rare: rhabdomyolysis (seek immediate care for unexplained muscle pain with dark urine), hepatitis, peripheral neuropathy.",
    drug_interactions:
      "CYP3A4 inhibitors (clarithromycin, itraconazole, ritonavir) increase statin exposure. Gemfibrozil increases myopathy risk. Warfarin — monitor INR. Grapefruit juice in large quantities.",
    dosage_instructions:
      "Take once daily at any time, with or without food. Starting dose: 10mg. Dose range: 10-80mg. LDL response seen within 2 weeks; maximum effect at 4 weeks.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Atorvastatin is a potent HMG-CoA reductase inhibitor (statin) that reduces LDL cholesterol, total cholesterol, and triglycerides while modestly increasing HDL. It is one of the most prescribed statins globally with robust evidence for cardiovascular event reduction.",
  },
  {
    title: "Atorvastatin 20mg Tablets",
    generic_name: "Atorvastatin Calcium",
    brand_name: "Atorva 20",
    manufacturer: "Zydus Lifesciences",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "20mg",
    pack_size: "10 tablets",
    composition: "Atorvastatin Calcium Trihydrate IP equivalent to Atorvastatin 20mg",
    therapeutic_category: "Cardiac Care",
    price: 80,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture and light.",
    indications:
      "Primary hypercholesterolaemia when 10mg is insufficient. Secondary prevention of cardiovascular events. Familial hypercholesterolaemia as adjunct to diet and other lipid-lowering measures.",
    contraindications:
      "Active liver disease, unexplained raised transaminases, pregnancy, lactation, concomitant cyclosporine.",
    side_effects:
      "Common: myalgia, GI symptoms, headache. Uncommon: raised CK, elevated liver enzymes, insomnia. Rare: rhabdomyolysis, myositis, hepatic failure, interstitial lung disease.",
    drug_interactions:
      "Avoid with strong CYP3A4 inhibitors (dose limit applies). Fibrates increase myopathy risk. Monitor warfarin INR. Niacin at high doses may increase risk of muscle problems.",
    dosage_instructions:
      "Take once daily at any time. Most patients start at 10mg; increase to 20mg if LDL target not met after 4 weeks. Maximum: 80mg/day.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Atorvastatin 20mg provides moderate-intensity statin therapy suitable for primary prevention in patients with elevated cardiovascular risk. It reduces LDL cholesterol by approximately 43% at this dose.",
  },
  {
    title: "Rosuvastatin 10mg Tablets",
    generic_name: "Rosuvastatin Calcium",
    brand_name: "Rozavel 10",
    manufacturer: "Sun Pharmaceutical Industries",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "10mg",
    pack_size: "10 tablets",
    composition: "Rosuvastatin Calcium IP equivalent to Rosuvastatin 10mg",
    therapeutic_category: "Cardiac Care",
    price: 60,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture.",
    indications:
      "Primary hypercholesterolaemia and mixed dyslipidaemia. Prevention of cardiovascular events in patients at high cardiovascular risk. Slowing of atherosclerosis progression.",
    contraindications:
      "Active liver disease, severe renal impairment (CrCl < 30 mL/min for doses > 5mg), concomitant cyclosporine, pregnancy, breastfeeding.",
    side_effects:
      "Common: headache, myalgia, constipation, asthenia, dizziness. Uncommon: pruritus, rash, abdominal pain. Rare: rhabdomyolysis, hepatitis, proteinuria, interstitial lung disease.",
    drug_interactions:
      "Cyclosporine significantly increases rosuvastatin levels (contraindicated). Warfarin — monitor INR at initiation. Gemfibrozil — limit rosuvastatin to 10mg. Antacids (take rosuvastatin 2 hrs before).",
    dosage_instructions:
      "Take once daily, preferably at bedtime. Starting dose: 5-10mg. Maximum: 40mg/day (reserved for severe hypercholesterolaemia under specialist care).",
    is_chronic: true,
    habit_forming: false,
    description:
      "Rosuvastatin is the most potent available statin, providing greater LDL reduction per milligram than other statins. The JUPITER trial demonstrated significant cardiovascular risk reduction even in patients with normal LDL but elevated CRP.",
  },
  {
    title: "Clopidogrel 75mg Tablets",
    generic_name: "Clopidogrel Bisulfate",
    brand_name: "Clavix 75",
    manufacturer: "Sun Pharmaceutical Industries",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "75mg",
    pack_size: "10 tablets",
    composition: "Clopidogrel Bisulfate IP equivalent to Clopidogrel 75mg",
    therapeutic_category: "Cardiac Care",
    price: 35,
    requires_prescription: true,
    storage_conditions: "Store below 25°C, protected from moisture.",
    indications:
      "Secondary prevention of atherothrombotic events in patients with recent myocardial infarction, ischaemic stroke, or established peripheral arterial disease. Acute coronary syndrome (with aspirin) including patients undergoing percutaneous coronary intervention with stent placement.",
    contraindications:
      "Active pathological bleeding (peptic ulcer, intracranial haemorrhage), severe hepatic impairment, hypersensitivity to clopidogrel.",
    side_effects:
      "Common: bleeding (GI, nasal, bruising), dyspepsia, abdominal pain, diarrhoea. Uncommon: intracranial haemorrhage, leucopenia, thrombocytopenia. Rare: thrombotic thrombocytopenic purpura (TTP), aplastic anaemia.",
    drug_interactions:
      "Omeprazole/esomeprazole reduce clopidogrel activation via CYP2C19 inhibition (use pantoprazole instead). Warfarin increases bleeding risk. NSAIDs potentiate GI bleeding. SSRI antidepressants increase bleeding risk.",
    dosage_instructions:
      "Take 75mg once daily with or without food. Loading dose for ACS: 300mg followed by 75mg/day. Duration: typically 12 months post-ACS/stent. Do not stop without medical advice.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Clopidogrel is a P2Y12 platelet receptor antagonist that inhibits ADP-mediated platelet aggregation. It is a prodrug requiring hepatic activation via CYP2C19. Dual antiplatelet therapy (clopidogrel + aspirin) is the standard of care after acute coronary syndrome.",
  },
  {
    title: "Aspirin 75mg Gastro-Resistant Tablets",
    generic_name: "Aspirin",
    brand_name: "Ecosprin 75",
    manufacturer: "USV Private Limited",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "75mg",
    pack_size: "14 tablets",
    composition: "Aspirin IP 75mg (Enteric Coated)",
    therapeutic_category: "Cardiac Care",
    price: 15,
    requires_prescription: false,
    storage_conditions: "Store below 25°C, protected from moisture. Keep in original blister packaging.",
    indications:
      "Secondary prevention of myocardial infarction and ischaemic stroke. Unstable angina. Post-percutaneous coronary intervention. Prevention of graft occlusion following coronary artery bypass grafting.",
    contraindications:
      "Active peptic ulcer, haemophilia and other bleeding disorders, severe hepatic or renal impairment, aspirin-sensitive asthma, last trimester of pregnancy.",
    side_effects:
      "Common: dyspepsia, nausea, increased bleeding tendency. Uncommon: GI ulceration and haemorrhage, bronchospasm in aspirin-sensitive patients. Rare: haemorrhagic stroke, Reye syndrome (in children with viral infections).",
    drug_interactions:
      "Warfarin and other anticoagulants — increased bleeding risk. NSAIDs — increased GI adverse effects. Ibuprofen may reduce cardioprotective effect. Methotrexate toxicity increased.",
    dosage_instructions:
      "Swallow whole with water; do not crush or chew (enteric-coated). Take 75mg once daily, preferably with breakfast. Take regularly at the same time each day.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Low-dose aspirin irreversibly inhibits platelet cyclooxygenase-1 (COX-1), reducing thromboxane A2 production and thereby preventing platelet aggregation. The enteric coating protects the gastric mucosa from direct irritation, reducing GI side effects.",
  },
  {
    title: "Aspirin 150mg Gastro-Resistant Tablets",
    generic_name: "Aspirin",
    brand_name: "Ecosprin 150",
    manufacturer: "USV Private Limited",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "150mg",
    pack_size: "14 tablets",
    composition: "Aspirin IP 150mg (Enteric Coated)",
    therapeutic_category: "Cardiac Care",
    price: 25,
    requires_prescription: false,
    storage_conditions: "Store below 25°C, protected from moisture.",
    indications:
      "Acute myocardial infarction (initial loading dose). Secondary prevention when 75mg is inadequate. Post-coronary stenting during the initial phase.",
    contraindications:
      "Active GI bleeding, bleeding diathesis, aspirin allergy, severe renal impairment, third trimester of pregnancy.",
    side_effects:
      "Common: GI discomfort, increased bleeding time. Uncommon: GI ulceration, bruising. Rare: haemorrhagic stroke, tinnitus (indicates toxicity).",
    drug_interactions:
      "Anticoagulants, antiplatelets — additive bleeding risk. NSAIDs. Methotrexate. Acetazolamide toxicity increased. Corticosteroids increase GI bleeding risk.",
    dosage_instructions:
      "Take once daily after food. Swallow whole; do not crush. Often used as a loading dose transitioning to 75mg maintenance.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Aspirin 150mg provides a higher antiplatelet dose suitable for acute cardiovascular events and initial treatment phases. Patients are typically transitioned to 75mg maintenance dose for long-term secondary prevention.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  VITAMINS & SUPPLEMENTS (8 products)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Cholecalciferol 60000 IU Capsules",
    generic_name: "Cholecalciferol (Vitamin D3)",
    brand_name: "D-Rise 60K",
    manufacturer: "USV Private Limited",
    drug_schedule: "OTC",
    dosage_form: "capsule",
    strength: "60000 IU",
    pack_size: "4 capsules",
    composition: "Cholecalciferol (Vitamin D3) IP 60000 IU",
    therapeutic_category: "Vitamins & Supplements",
    price: 120,
    requires_prescription: false,
    storage_conditions: "Store below 25°C, protected from light and moisture. Keep in original packing.",
    indications:
      "Treatment and prevention of Vitamin D deficiency. Osteoporosis and osteomalacia. As adjunct to calcium supplementation in postmenopausal women. Rickets in children.",
    contraindications:
      "Hypercalcaemia, hypervitaminosis D, severe renal impairment, known hypersensitivity. Use with caution in sarcoidosis and other granulomatous diseases.",
    side_effects:
      "Uncommon (at therapeutic doses): nausea, constipation, hypercalcaemia (with overdose). Signs of toxicity: anorexia, weight loss, polyuria, excessive thirst, dehydration, renal calculi.",
    drug_interactions:
      "Thiazide diuretics may increase risk of hypercalcaemia. Corticosteroids reduce Vitamin D absorption. Orlistat, cholestyramine reduce absorption. Monitor calcium levels with cardiac glycosides.",
    dosage_instructions:
      "For deficiency: 60000 IU once weekly for 8-12 weeks, then monthly maintenance. Take with a fatty meal for optimal absorption. Follow up with serum 25(OH)D levels.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Cholecalciferol 60000 IU is the standard high-dose Vitamin D3 formulation widely prescribed in India where Vitamin D deficiency is prevalent despite abundant sunlight. Weekly dosing provides convenient compliance compared to daily low-dose supplementation.",
  },
  {
    title: "Vitamin B Complex Tablets",
    generic_name: "Vitamin B Complex",
    brand_name: "Becosules",
    manufacturer: "Pfizer Limited (India)",
    drug_schedule: "OTC",
    dosage_form: "capsule",
    strength: "Multi-vitamin B",
    pack_size: "20 capsules",
    composition: "Thiamine Mononitrate 10mg, Riboflavin 10mg, Pyridoxine HCl 3mg, Nicotinamide 100mg, Calcium Pantothenate 50mg, Folic Acid 1.5mg, Cyanocobalamin 15mcg, Biotin 100mcg, Ascorbic Acid 150mg",
    therapeutic_category: "Vitamins & Supplements",
    price: 45,
    requires_prescription: false,
    storage_conditions: "Store below 30°C, protected from light and moisture.",
    indications:
      "Prophylaxis and treatment of B-vitamin deficiencies. Mouth ulcers (aphthous stomatitis). General debility and convalescence. As nutritional supplement during pregnancy, lactation, and periods of increased requirement.",
    contraindications:
      "Known hypersensitivity to any component. Pernicious anaemia (folic acid may mask B12 deficiency — always check B12 levels).",
    side_effects:
      "Generally well tolerated. Uncommon: mild GI upset, yellow discolouration of urine (harmless, due to riboflavin). Rare: allergic reactions.",
    drug_interactions:
      "Levodopa efficacy may be reduced by pyridoxine (not relevant with carbidopa co-administration). Phenytoin and phenobarbitone levels may be altered by folic acid. Metformin may reduce B12 absorption.",
    dosage_instructions:
      "Take one capsule daily after meals. For active deficiency: one capsule twice daily for 2-4 weeks, then once daily maintenance.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Vitamin B Complex provides a comprehensive blend of essential B vitamins plus Vitamin C. B vitamins serve as coenzymes in energy metabolism, nervous system function, and red blood cell formation. This formulation addresses the most common micronutrient deficiencies in the Indian population.",
  },
  {
    title: "Calcium Carbonate + Vitamin D3 Tablets",
    generic_name: "Calcium Carbonate + Cholecalciferol",
    brand_name: "Shelcal 500",
    manufacturer: "Torrent Pharmaceuticals",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "500mg + 250 IU",
    pack_size: "15 tablets",
    composition: "Calcium Carbonate IP equivalent to Elemental Calcium 500mg + Vitamin D3 IP 250 IU",
    therapeutic_category: "Vitamins & Supplements",
    price: 85,
    requires_prescription: false,
    storage_conditions: "Store below 30°C, protected from moisture.",
    indications:
      "Prevention and treatment of calcium and Vitamin D deficiency. Osteoporosis prevention and treatment as adjunct therapy. Pregnancy and lactation supplementation. Growing children and adolescents.",
    contraindications:
      "Hypercalcaemia, hypercalciuria, renal calculi (calcium-containing), severe renal impairment, hypervitaminosis D.",
    side_effects:
      "Common: constipation, flatulence, bloating. Uncommon: hypercalcaemia, hypercalciuria, nausea. Rare: renal calculi with prolonged high-dose use. Milk-alkali syndrome with excessive intake.",
    drug_interactions:
      "Reduces absorption of tetracyclines, quinolones, bisphosphonates, levothyroxine, and iron (take 2 hours apart). Thiazide diuretics increase hypercalcaemia risk. Corticosteroids reduce calcium absorption.",
    dosage_instructions:
      "Take one tablet twice daily after meals. Chew before swallowing for better absorption. Space 2 hours from other medications. Take with plenty of water.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Calcium with Vitamin D3 provides the essential minerals for bone health. Vitamin D3 enhances intestinal calcium absorption, making this combination more effective than calcium alone. Particularly important for postmenopausal women, elderly patients, and those at risk of osteoporosis.",
  },
  {
    title: "Ferrous Ascorbate + Folic Acid Tablets",
    generic_name: "Ferrous Ascorbate + Folic Acid",
    brand_name: "Orofer XT",
    manufacturer: "Emcure Pharmaceuticals",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "100mg + 1.5mg",
    pack_size: "10 tablets",
    composition: "Ferrous Ascorbate equivalent to Elemental Iron 100mg + Folic Acid IP 1.5mg",
    therapeutic_category: "Vitamins & Supplements",
    price: 55,
    requires_prescription: false,
    storage_conditions: "Store below 30°C, protected from moisture and light.",
    indications:
      "Iron deficiency anaemia. Prophylaxis of iron and folic acid deficiency during pregnancy. Megaloblastic anaemia due to folate deficiency. Post-surgical and post-haemorrhagic anaemia.",
    contraindications:
      "Haemochromatosis, haemosiderosis, haemolytic anaemias (unless co-existing iron deficiency), intestinal diverticulitis, known hypersensitivity.",
    side_effects:
      "Common: nausea, constipation, dark stools (harmless), abdominal discomfort. Uncommon: diarrhoea, heartburn, teeth staining. Rare: allergic reactions.",
    drug_interactions:
      "Antacids, calcium, and tetracyclines reduce iron absorption (space 2 hours). Tea and coffee reduce absorption. Ascorbic acid in formulation enhances iron absorption. Levodopa absorption may be reduced.",
    dosage_instructions:
      "Take one tablet daily, preferably on empty stomach or 1 hour before meals for maximum absorption. If GI side effects occur, take with food. Continue for 3 months after haemoglobin normalisation to replenish stores.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Ferrous Ascorbate provides iron in a chelated form with ascorbic acid, offering superior bioavailability and better GI tolerance compared to conventional ferrous sulphate. The inclusion of folic acid supports red blood cell maturation, making it ideal for comprehensive anaemia management.",
  },
  {
    title: "Zinc Gluconate 50mg Tablets",
    generic_name: "Zinc Gluconate",
    brand_name: "Zincovit Z",
    manufacturer: "Apex Laboratories",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "50mg",
    pack_size: "10 tablets",
    composition: "Zinc Gluconate equivalent to Elemental Zinc 50mg",
    therapeutic_category: "Vitamins & Supplements",
    price: 40,
    requires_prescription: false,
    storage_conditions: "Store below 30°C in a dry place.",
    indications:
      "Zinc deficiency. Adjunct in treatment of acute diarrhoea in children. Immune support. Acne vulgaris as adjunct therapy. Wilson disease (zinc acetate).",
    contraindications:
      "Known hypersensitivity to zinc salts. Caution in renal impairment (zinc accumulation).",
    side_effects:
      "Common: nausea (especially on empty stomach), metallic taste, GI upset. Uncommon: copper deficiency with prolonged high-dose use, headache. Rare: zinc fume fever (industrial exposure).",
    drug_interactions:
      "Reduces absorption of tetracyclines, quinolones, and penicillamine (take 2 hours apart). Calcium and iron supplements may reduce zinc absorption when taken together.",
    dosage_instructions:
      "Take one tablet daily after meals. For acute diarrhoea in children: 20mg/day for 10-14 days. Avoid taking with dairy products.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Zinc is an essential trace mineral involved in over 300 enzymatic reactions in the body. It is critical for immune function, wound healing, DNA synthesis, and cell division. Zinc deficiency is common in the Indian population, particularly in vegetarians and children.",
  },
  {
    title: "Omega-3 Fish Oil 1000mg Capsules",
    generic_name: "Omega-3 Fatty Acids (EPA + DHA)",
    brand_name: "Maxepa",
    manufacturer: "Merck Limited (India)",
    drug_schedule: "OTC",
    dosage_form: "capsule",
    strength: "1000mg",
    pack_size: "10 capsules",
    composition: "Omega-3 Marine Triglycerides 1000mg providing EPA 180mg + DHA 120mg",
    therapeutic_category: "Vitamins & Supplements",
    price: 150,
    requires_prescription: false,
    storage_conditions: "Store below 25°C, protected from light. Refrigerate after opening to prevent rancidity.",
    indications:
      "Hypertriglyceridaemia as adjunct to diet. Cardiovascular risk reduction. Rheumatoid arthritis (adjunct for joint inflammation). General health and brain function support.",
    contraindications:
      "Known allergy to fish or shellfish. Active bleeding disorders. Caution in patients on anticoagulants.",
    side_effects:
      "Common: fishy aftertaste, burping, nausea, bloating. Uncommon: diarrhoea, dyspepsia, body odour changes. Rare: increased bleeding time, LDL elevation in some patients.",
    drug_interactions:
      "Anticoagulants and antiplatelets — may potentiate bleeding (monitor INR with warfarin). Orlistat may reduce absorption. May modestly lower blood pressure (additive with antihypertensives).",
    dosage_instructions:
      "Take 1-2 capsules daily with meals. For hypertriglyceridaemia: 2-4 capsules daily. Swallow whole; do not chew (to avoid fishy aftertaste). Take with largest meal.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Omega-3 fish oil provides essential polyunsaturated fatty acids (EPA and DHA) that the body cannot synthesise. These fatty acids reduce triglyceride synthesis in the liver, have anti-inflammatory properties, and support cardiovascular, brain, and joint health.",
  },
  {
    title: "Multivitamin Multimineral Tablets",
    generic_name: "Multivitamin + Multimineral",
    brand_name: "Supradyn",
    manufacturer: "Bayer Zydus Pharma",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "Multi",
    pack_size: "15 tablets",
    composition: "Vitamin A, B1, B2, B6, B12, C, D3, E, Folic Acid, Niacinamide, Calcium Pantothenate, Iron, Calcium, Phosphorus, Magnesium, Manganese, Zinc, Copper, Molybdenum, Biotin",
    therapeutic_category: "Vitamins & Supplements",
    price: 95,
    requires_prescription: false,
    storage_conditions: "Store below 30°C, protected from moisture and direct sunlight.",
    indications:
      "Nutritional supplementation during periods of increased requirement: convalescence, pregnancy, lactation, elderly, athletes. Prevention of micronutrient deficiencies.",
    contraindications:
      "Hypervitaminosis A or D. Iron overload disorders. Known hypersensitivity to any component.",
    side_effects:
      "Generally well tolerated at recommended doses. Uncommon: nausea, constipation, dark stools (iron content), yellow urine (riboflavin). Rare: allergic reactions.",
    drug_interactions:
      "Iron content may reduce tetracycline and quinolone absorption. Calcium may reduce levothyroxine absorption. Take 2 hours apart from these medications.",
    dosage_instructions:
      "Take one tablet daily after the largest meal. Swallow whole with water. Do not take on an empty stomach.",
    is_chronic: false,
    habit_forming: false,
    description:
      "A comprehensive multivitamin-multimineral formulation providing the daily recommended intake of essential micronutrients. Designed to fill nutritional gaps common in modern diets, particularly relevant for the Indian population with high rates of micronutrient deficiencies.",
  },
  {
    title: "Biotin 10000mcg Tablets",
    generic_name: "Biotin (Vitamin B7)",
    brand_name: "Keraglo",
    manufacturer: "J B Chemicals & Pharmaceuticals",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "10000mcg",
    pack_size: "10 tablets",
    composition: "Biotin (D-Biotin) 10000mcg (10mg)",
    therapeutic_category: "Vitamins & Supplements",
    price: 180,
    requires_prescription: false,
    storage_conditions: "Store below 30°C, protected from moisture.",
    indications:
      "Biotin deficiency. Hair loss (telogen effluvium, pattern hair loss as adjunct). Brittle nails. Seborrhoeic dermatitis. Adjunct in inherited biotin-responsive disorders.",
    contraindications:
      "Known hypersensitivity. Note: high-dose biotin may interfere with laboratory tests using streptavidin-biotin immunoassay technology (thyroid function, troponin, hCG).",
    side_effects:
      "Generally well tolerated even at high doses (water-soluble vitamin). Rare: skin rash, GI upset. Important: may cause falsely low troponin results — inform doctors about supplementation.",
    drug_interactions:
      "Raw egg whites contain avidin which binds biotin (avoid consuming raw eggs). Anticonvulsants (carbamazepine, phenytoin) may reduce biotin levels. No significant drug-drug interactions at therapeutic doses.",
    dosage_instructions:
      "Take one tablet daily with or without food. For hair and nail conditions: use for at least 3-6 months to assess response. Inform healthcare providers about biotin supplementation before laboratory testing.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Biotin (Vitamin B7) is a water-soluble B-vitamin essential for fatty acid synthesis, amino acid metabolism, and gluconeogenesis. At supraphysiological doses (10000mcg), it may improve hair thickness and nail strength, though evidence is primarily from case series rather than large controlled trials.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  PAIN & FEVER (6 products)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Paracetamol 500mg Tablets",
    generic_name: "Paracetamol (Acetaminophen)",
    brand_name: "Crocin 500",
    manufacturer: "GlaxoSmithKline Consumer Healthcare",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "500mg",
    pack_size: "10 tablets",
    composition: "Paracetamol IP 500mg",
    therapeutic_category: "Pain & Fever",
    price: 15,
    requires_prescription: false,
    storage_conditions: "Store below 30°C, protected from moisture and light.",
    indications:
      "Mild to moderate pain including headache, toothache, musculoskeletal pain, dysmenorrhoea. Fever associated with common infections.",
    contraindications:
      "Severe hepatic impairment, known hypersensitivity. Caution in chronic alcohol use, malnutrition, dehydration, and chronic liver disease.",
    side_effects:
      "Rare at therapeutic doses: skin rash, blood dyscrasias, hepatotoxicity (only with overdose — > 4g/day). Paracetamol overdose causes potentially fatal hepatic necrosis — acetylcysteine is the antidote.",
    drug_interactions:
      "Warfarin — regular paracetamol use may increase INR (monitor). Metoclopramide and domperidone increase paracetamol absorption rate. Cholestyramine reduces absorption. Alcohol increases hepatotoxicity risk.",
    dosage_instructions:
      "Adults: 500mg-1000mg every 4-6 hours as needed. Maximum: 4000mg (4g) per day. Children: dose based on weight (15mg/kg per dose). Do not exceed stated dose.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Paracetamol is the most widely used analgesic and antipyretic worldwide. It inhibits prostaglandin synthesis in the central nervous system, providing pain relief and fever reduction with an excellent safety profile at recommended doses. It lacks the anti-inflammatory and antiplatelet effects of NSAIDs.",
  },
  {
    title: "Paracetamol 650mg Tablets",
    generic_name: "Paracetamol (Acetaminophen)",
    brand_name: "Dolo 650",
    manufacturer: "Micro Labs Limited",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "650mg",
    pack_size: "15 tablets",
    composition: "Paracetamol IP 650mg",
    therapeutic_category: "Pain & Fever",
    price: 20,
    requires_prescription: false,
    storage_conditions: "Store below 30°C, protected from moisture.",
    indications:
      "Moderate pain and fever not adequately managed by 500mg paracetamol. Headache, body ache, fever associated with cold and flu, post-vaccination fever, musculoskeletal pain.",
    contraindications:
      "Severe hepatic impairment, active liver disease, known hypersensitivity. Maximum 3 tablets per day to stay within 4g limit.",
    side_effects:
      "Well tolerated at recommended doses. Rare: skin rash, thrombocytopenia. Overdose: hepatotoxicity (onset 24-72 hours — may be asymptomatic initially), renal tubular necrosis.",
    drug_interactions:
      "Warfarin — monitor INR with regular use. Isoniazid may increase hepatotoxicity risk. Alcohol — limit consumption. Enzyme-inducing drugs (rifampicin, phenytoin) increase toxic metabolite formation.",
    dosage_instructions:
      "Take 1 tablet every 6-8 hours as needed. Maximum: 3 tablets (1950mg) per day. Do not use with other paracetamol-containing products. Do not use for more than 3 days for fever without medical advice.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Dolo 650 is the most recognised paracetamol brand in India, especially after widespread use during the COVID-19 pandemic. The 650mg dose provides enhanced analgesic and antipyretic effect compared to 500mg while maintaining the safety profile at recommended dosing intervals.",
  },
  {
    title: "Ibuprofen 400mg Tablets",
    generic_name: "Ibuprofen",
    brand_name: "Brufen 400",
    manufacturer: "Abbott India Limited",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "400mg",
    pack_size: "10 tablets",
    composition: "Ibuprofen IP 400mg",
    therapeutic_category: "Pain & Fever",
    price: 25,
    requires_prescription: false,
    storage_conditions: "Store below 30°C, protected from moisture and light.",
    indications:
      "Mild to moderate pain, inflammatory conditions including rheumatoid arthritis, osteoarthritis, ankylosing spondylitis, soft tissue injuries, dysmenorrhoea, dental pain, post-operative pain, fever.",
    contraindications:
      "Active or history of GI ulceration/bleeding, severe heart failure (NYHA IV), severe renal impairment, third trimester of pregnancy, aspirin-intolerant asthma, concomitant use of other NSAIDs.",
    side_effects:
      "Common: dyspepsia, nausea, abdominal pain, diarrhoea. Uncommon: GI ulceration, headache, dizziness, fluid retention. Rare: GI haemorrhage, bronchospasm, Stevens-Johnson syndrome, renal impairment, hepatitis.",
    drug_interactions:
      "Anticoagulants — increased bleeding risk. Low-dose aspirin — ibuprofen may reduce cardioprotective effect (take aspirin 30 min before). ACE inhibitors/ARBs — reduced antihypertensive effect. Lithium and methotrexate levels increased.",
    dosage_instructions:
      "Take 200-400mg every 6-8 hours with food. Maximum: 1200mg/day (OTC) or 2400mg/day (prescription). Use the lowest effective dose for the shortest duration.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Ibuprofen is a non-selective NSAID that inhibits both COX-1 and COX-2 enzymes, providing analgesic, anti-inflammatory, and antipyretic effects. Among NSAIDs, it has one of the best cardiovascular safety profiles and is considered first-line for inflammatory pain.",
  },
  {
    title: "Diclofenac Sodium 50mg Tablets",
    generic_name: "Diclofenac Sodium",
    brand_name: "Voveran 50",
    manufacturer: "Novartis India Limited",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "50mg",
    pack_size: "10 tablets",
    composition: "Diclofenac Sodium IP 50mg (Enteric Coated)",
    therapeutic_category: "Pain & Fever",
    price: 30,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture and light.",
    indications:
      "Inflammatory and degenerative conditions of the musculoskeletal system: rheumatoid arthritis, osteoarthritis, ankylosing spondylitis. Acute gout, renal colic, post-operative pain, dysmenorrhoea, migraine.",
    contraindications:
      "Active GI ulceration or bleeding, severe hepatic or renal impairment, established ischaemic heart disease, cerebrovascular disease, peripheral arterial disease, severe heart failure, third trimester of pregnancy.",
    side_effects:
      "Common: GI disturbances, headache, dizziness. Uncommon: elevated liver enzymes, fluid retention, rash. Rare: GI bleeding/perforation, hepatitis, aplastic anaemia, severe skin reactions (SJS/TEN), cardiovascular thrombotic events.",
    drug_interactions:
      "Anticoagulants, antiplatelets — increased bleeding risk. ACE inhibitors/ARBs — reduced efficacy and renal risk. Lithium, methotrexate, digoxin levels increased. SSRIs increase GI bleeding risk.",
    dosage_instructions:
      "Take 50mg 2-3 times daily with food. Swallow whole; do not crush (enteric coated). Maximum: 150mg/day. Use for shortest duration necessary.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Diclofenac is one of the most potent NSAIDs for musculoskeletal pain, combining strong anti-inflammatory, analgesic, and antipyretic activity. Its enteric coating minimises direct gastric irritation, though systemic GI and cardiovascular risks remain with prolonged use.",
  },
  {
    title: "Aceclofenac 100mg Tablets",
    generic_name: "Aceclofenac",
    brand_name: "Zerodol 100",
    manufacturer: "IPCA Laboratories",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "100mg",
    pack_size: "10 tablets",
    composition: "Aceclofenac IP 100mg",
    therapeutic_category: "Pain & Fever",
    price: 45,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture and light.",
    indications:
      "Rheumatoid arthritis, osteoarthritis, ankylosing spondylitis. Acute musculoskeletal disorders including sprains, strains, and low back pain. Dental pain, dysmenorrhoea.",
    contraindications:
      "Active peptic ulcer or GI bleeding, severe hepatic or renal impairment, established cardiovascular disease, aspirin-sensitive asthma, third trimester of pregnancy.",
    side_effects:
      "Common: dyspepsia, nausea, diarrhoea, abdominal pain. Uncommon: dizziness, elevated liver enzymes, skin rash. Rare: GI perforation, hepatitis, blood dyscrasias, Stevens-Johnson syndrome.",
    drug_interactions:
      "Warfarin and heparin — bleeding risk. ACE inhibitors — reduced efficacy. Methotrexate — increased toxicity. Lithium levels increased. Diuretics — reduced natriuretic effect.",
    dosage_instructions:
      "Take 100mg twice daily with food. Do not exceed 200mg/day. Use the lowest effective dose for the shortest duration.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Aceclofenac is a phenylacetic acid derivative NSAID that primarily inhibits COX-2, providing effective pain relief with relatively better GI tolerability than some traditional NSAIDs. It is metabolised partly to diclofenac, contributing to its analgesic potency.",
  },
  {
    title: "Nimesulide 100mg Tablets",
    generic_name: "Nimesulide",
    brand_name: "Nise 100",
    manufacturer: "Dr. Reddy's Laboratories",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "100mg",
    pack_size: "10 tablets",
    composition: "Nimesulide IP 100mg",
    therapeutic_category: "Pain & Fever",
    price: 35,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture.",
    indications:
      "Acute pain, painful osteoarthritis, primary dysmenorrhoea. Short-term treatment only (not recommended for more than 15 days at a time).",
    contraindications:
      "Hepatic impairment, history of hepatotoxic reactions to nimesulide, active GI bleeding, concomitant hepatotoxic drugs, children under 12 years, third trimester of pregnancy, fever in children.",
    side_effects:
      "Common: nausea, diarrhoea, vomiting, dizziness. Uncommon: elevated liver enzymes, pruritus, rash. Rare: fulminant hepatitis (potentially fatal — discontinue if liver function abnormalities develop), renal failure.",
    drug_interactions:
      "Avoid with other hepatotoxic drugs (paracetamol in high doses, anti-TB drugs). Warfarin — increased bleeding risk. Lithium, methotrexate levels increased. CYP2C9 inhibitors may increase nimesulide levels.",
    dosage_instructions:
      "Take 100mg twice daily after food. Maximum duration: 15 days per treatment course. Maximum: 200mg/day. Monitor liver function during treatment.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Nimesulide is a preferential COX-2 inhibitor with rapid onset of analgesic action. It is one of the most prescribed pain medicines in India despite concerns about hepatotoxicity that led to its withdrawal in several countries. Restricted to short-term use and contraindicated in children for fever.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  ANTIBIOTICS (6 products)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Amoxicillin 500mg Capsules",
    generic_name: "Amoxicillin Trihydrate",
    brand_name: "Mox 500",
    manufacturer: "Ranbaxy Laboratories (Sun Pharma)",
    drug_schedule: "H",
    dosage_form: "capsule",
    strength: "500mg",
    pack_size: "10 capsules",
    composition: "Amoxicillin Trihydrate IP equivalent to Amoxicillin 500mg",
    therapeutic_category: "Antibiotics",
    price: 65,
    requires_prescription: true,
    storage_conditions: "Store below 25°C, protected from moisture. Keep in original packing.",
    indications:
      "Upper and lower respiratory tract infections, otitis media, sinusitis, urinary tract infections, skin and soft tissue infections, dental infections, H. pylori eradication (in combination therapy), typhoid fever.",
    contraindications:
      "Known hypersensitivity to penicillins. History of penicillin-associated cholestatic jaundice or hepatic dysfunction. Caution in patients with cephalosporin allergy (cross-reactivity).",
    side_effects:
      "Common: diarrhoea, nausea, skin rash. Uncommon: vomiting, candidiasis (oral/vaginal), urticaria. Rare: anaphylaxis, antibiotic-associated colitis (C. difficile), Stevens-Johnson syndrome, hepatitis, crystalluria.",
    drug_interactions:
      "Probenecid increases amoxicillin levels. Allopurinol increases rash incidence. May reduce efficacy of oral contraceptives. Methotrexate clearance reduced. Warfarin — monitor INR.",
    dosage_instructions:
      "Take 500mg every 8 hours with or without food. For severe infections: 500mg every 6 hours. Complete the full prescribed course even if symptoms improve. Duration: typically 5-7 days.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Amoxicillin is a broad-spectrum aminopenicillin antibiotic active against many Gram-positive and some Gram-negative bacteria. It has excellent oral bioavailability and is the most commonly prescribed antibiotic in primary care for respiratory and urinary tract infections.",
  },
  {
    title: "Azithromycin 500mg Tablets",
    generic_name: "Azithromycin Dihydrate",
    brand_name: "Azithral 500",
    manufacturer: "Alembic Pharmaceuticals",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "500mg",
    pack_size: "3 tablets",
    composition: "Azithromycin Dihydrate IP equivalent to Azithromycin 500mg",
    therapeutic_category: "Antibiotics",
    price: 75,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture and light.",
    indications:
      "Community-acquired pneumonia, acute bacterial sinusitis, pharyngitis/tonsillitis, acute otitis media, uncomplicated skin infections, urethritis and cervicitis (C. trachomatis), typhoid fever.",
    contraindications:
      "Hypersensitivity to azithromycin, erythromycin, or any macrolide. History of cholestatic jaundice with prior azithromycin use. Concomitant ergotamine/dihydroergotamine.",
    side_effects:
      "Common: diarrhoea, nausea, abdominal pain. Uncommon: headache, dizziness, vomiting, elevated liver enzymes. Rare: QT prolongation (avoid in patients with cardiac risk factors), hepatotoxicity, Clostridioides difficile colitis, hearing disturbances.",
    drug_interactions:
      "Antacids reduce absorption (take 1 hour before or 2 hours after). Warfarin — monitor INR. Statins — increased rhabdomyolysis risk (rare). Cyclosporine levels may increase. Avoid with QT-prolonging drugs.",
    dosage_instructions:
      "Take 500mg once daily for 3 days (most common regimen). Alternative: 500mg day 1, then 250mg days 2-5. Take 1 hour before or 2 hours after meals for optimal absorption.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Azithromycin is a macrolide antibiotic with an exceptionally long tissue half-life (68 hours), allowing short 3-5 day courses. It concentrates in phagocytes, delivering high concentrations to infection sites. Its convenient dosing improves patient compliance significantly.",
  },
  {
    title: "Ciprofloxacin 500mg Tablets",
    generic_name: "Ciprofloxacin Hydrochloride",
    brand_name: "Ciplox 500",
    manufacturer: "Cipla Limited",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "500mg",
    pack_size: "10 tablets",
    composition: "Ciprofloxacin Hydrochloride IP equivalent to Ciprofloxacin 500mg",
    therapeutic_category: "Antibiotics",
    price: 55,
    requires_prescription: true,
    storage_conditions: "Store below 25°C, protected from moisture and light.",
    indications:
      "Complicated urinary tract infections, acute uncomplicated cystitis, chronic bacterial prostatitis, lower respiratory tract infections, bone and joint infections, infectious diarrhoea, typhoid fever, intra-abdominal infections (with metronidazole).",
    contraindications:
      "Known hypersensitivity to fluoroquinolones, concomitant tizanidine, history of tendon disorders related to quinolone use, children and adolescents (growing cartilage damage), epilepsy, myasthenia gravis.",
    side_effects:
      "Common: nausea, diarrhoea, headache. Uncommon: tendinitis and tendon rupture (especially Achilles), peripheral neuropathy, photosensitivity, QT prolongation, CNS effects (insomnia, dizziness). Rare: aortic aneurysm/dissection, C. difficile colitis.",
    drug_interactions:
      "Antacids, calcium, iron, zinc reduce absorption (take ciprofloxacin 2 hours before or 6 hours after). Theophylline levels increased. Warfarin — enhanced anticoagulation. NSAIDs may increase seizure risk. Dairy products reduce absorption.",
    dosage_instructions:
      "Take 500mg every 12 hours. Duration: UTI 3-14 days, respiratory 7-14 days. Ensure adequate hydration to prevent crystalluria. Avoid excessive sun exposure.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Ciprofloxacin is a second-generation fluoroquinolone with broad-spectrum bactericidal activity, particularly strong against Gram-negative organisms. FDA black box warnings regarding tendinitis, neuropathy, and CNS effects should be considered — reserve for infections where benefits outweigh risks.",
  },
  {
    title: "Cefixime 200mg Tablets",
    generic_name: "Cefixime Trihydrate",
    brand_name: "Taxim-O 200",
    manufacturer: "Alkem Laboratories",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "200mg",
    pack_size: "10 tablets",
    composition: "Cefixime Trihydrate IP equivalent to Cefixime 200mg",
    therapeutic_category: "Antibiotics",
    price: 80,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture.",
    indications:
      "Upper and lower respiratory tract infections, acute otitis media, urinary tract infections including uncomplicated gonorrhoea, typhoid fever, biliary tract infections.",
    contraindications:
      "Known hypersensitivity to cephalosporins or severe penicillin allergy (cross-reactivity approximately 1-3%). Caution in renal impairment (dose adjustment required).",
    side_effects:
      "Common: diarrhoea (up to 15%), abdominal pain, nausea. Uncommon: headache, dizziness, skin rash, pruritus. Rare: C. difficile colitis, haemolytic anaemia, elevated liver enzymes, serum sickness-like reaction.",
    drug_interactions:
      "Probenecid increases cefixime levels. May interfere with glucose tests (false positive with Benedict's reagent). Aminoglycosides — potential nephrotoxicity synergy. Warfarin — monitor INR.",
    dosage_instructions:
      "Take 200mg twice daily or 400mg once daily. For uncomplicated gonorrhoea: single 400mg dose. Take with or without food. Duration: typically 7-14 days depending on infection.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Cefixime is a third-generation oral cephalosporin with extended Gram-negative coverage. It is resistant to many beta-lactamases and is particularly useful for resistant UTIs and respiratory infections. It is one of the most commonly prescribed cephalosporins in Indian clinical practice.",
  },
  {
    title: "Doxycycline 100mg Capsules",
    generic_name: "Doxycycline Hydrochloride",
    brand_name: "Doxt-SL 100",
    manufacturer: "Dr. Reddy's Laboratories",
    drug_schedule: "H",
    dosage_form: "capsule",
    strength: "100mg",
    pack_size: "10 capsules",
    composition: "Doxycycline Hydrochloride IP equivalent to Doxycycline 100mg",
    therapeutic_category: "Antibiotics",
    price: 40,
    requires_prescription: true,
    storage_conditions: "Store below 25°C, protected from light and moisture.",
    indications:
      "Acne vulgaris, respiratory tract infections, urinary tract infections, sexually transmitted infections (chlamydia, gonorrhoea as part of combination), rickettsial infections, leptospirosis, malaria prophylaxis, Lyme disease.",
    contraindications:
      "Children under 8 years (permanent teeth discolouration), pregnancy and lactation, severe hepatic impairment, known hypersensitivity to tetracyclines, myasthenia gravis (may worsen).",
    side_effects:
      "Common: nausea, diarrhoea, photosensitivity (use sunscreen), oesophageal ulceration (if taken lying down). Uncommon: candidiasis, headache, visual disturbances. Rare: intracranial hypertension, hepatotoxicity, drug hypersensitivity syndrome.",
    drug_interactions:
      "Antacids, calcium, iron, zinc reduce absorption. Barbiturates and phenytoin reduce doxycycline half-life. Enhances warfarin effect. Oral contraceptive efficacy may be reduced. Avoid with retinoids (intracranial hypertension risk).",
    dosage_instructions:
      "Take 100mg twice daily on day 1, then 100mg once daily. Take with a full glass of water while sitting upright. Can be taken with food (unlike other tetracyclines). Avoid lying down for 30 minutes after dose.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Doxycycline is a tetracycline antibiotic with broad-spectrum activity including atypical pathogens (Mycoplasma, Chlamydia, Rickettsia). Unlike older tetracyclines, its absorption is minimally affected by food, and it can be used in patients with renal impairment without dose adjustment.",
  },
  {
    title: "Levofloxacin 500mg Tablets",
    generic_name: "Levofloxacin Hemihydrate",
    brand_name: "Levomac 500",
    manufacturer: "Macleods Pharmaceuticals",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "500mg",
    pack_size: "10 tablets",
    composition: "Levofloxacin Hemihydrate IP equivalent to Levofloxacin 500mg",
    therapeutic_category: "Antibiotics",
    price: 70,
    requires_prescription: true,
    storage_conditions: "Store below 25°C, protected from light and moisture.",
    indications:
      "Community-acquired pneumonia, acute bacterial sinusitis, acute bacterial exacerbation of chronic bronchitis, complicated urinary tract infections, acute pyelonephritis, skin and soft tissue infections.",
    contraindications:
      "History of tendon disorders with fluoroquinolones, epilepsy, concomitant class IA/III antiarrhythmics, children and adolescents, myasthenia gravis, glucose-6-phosphate dehydrogenase deficiency.",
    side_effects:
      "Common: nausea, diarrhoea, headache, insomnia. Uncommon: tendinitis (especially Achilles), dizziness, QT prolongation, photosensitivity, peripheral neuropathy. Rare: tendon rupture, aortic aneurysm, liver failure, C. difficile colitis.",
    drug_interactions:
      "Antacids, sucralfate, iron, zinc: take levofloxacin 2 hours before or 2 hours after. NSAIDs increase seizure risk. Warfarin: monitor INR. Theophylline levels may increase. QT-prolonging drugs: additive cardiac risk.",
    dosage_instructions:
      "Take 500mg once daily. Duration: pneumonia 7-14 days, sinusitis 5-14 days, UTI 3-14 days. Take with adequate fluids. Avoid excessive sun exposure.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Levofloxacin is the L-isomer of ofloxacin, a third-generation fluoroquinolone with enhanced Gram-positive activity (respiratory fluoroquinolone). It is particularly effective for respiratory tract infections and complicated UTIs. Use should be reserved for infections where other antibiotics are unsuitable.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  GASTROINTESTINAL (6 products)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Pantoprazole 40mg Tablets",
    generic_name: "Pantoprazole Sodium Sesquihydrate",
    brand_name: "Pan 40",
    manufacturer: "Alkem Laboratories",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "40mg",
    pack_size: "10 tablets",
    composition: "Pantoprazole Sodium Sesquihydrate IP equivalent to Pantoprazole 40mg (Enteric Coated)",
    therapeutic_category: "Gastrointestinal",
    price: 45,
    requires_prescription: true,
    storage_conditions: "Store below 25°C, protected from moisture. Keep in original packaging.",
    indications:
      "Gastro-oesophageal reflux disease (GERD), erosive oesophagitis, peptic ulcer disease (gastric and duodenal), Zollinger-Ellison syndrome, NSAID-associated gastric ulcers (treatment and prophylaxis), H. pylori eradication (as part of combination therapy).",
    contraindications:
      "Known hypersensitivity to pantoprazole or other PPIs. Concomitant atazanavir or nelfinavir (reduced antiviral absorption).",
    side_effects:
      "Common: headache, diarrhoea, nausea, abdominal pain, flatulence. Uncommon: dizziness, constipation, dry mouth, elevated liver enzymes. Long-term: vitamin B12 deficiency, hypomagnesaemia, increased fracture risk, fundic gland polyps, C. difficile colitis.",
    drug_interactions:
      "Reduces absorption of ketoconazole, itraconazole, erlotinib, and iron salts (pH-dependent). Contraindicated with atazanavir. May increase methotrexate levels. Clopidogrel interaction less clinically significant than with omeprazole/esomeprazole.",
    dosage_instructions:
      "Take 40mg once daily before breakfast. Swallow whole; do not crush or chew. For H. pylori: 40mg twice daily with antibiotics for 7-14 days. Taper gradually after long-term use.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Pantoprazole is a proton pump inhibitor (PPI) that irreversibly inhibits the H+/K+-ATPase enzyme system in gastric parietal cells, providing potent and sustained acid suppression. It has fewer CYP2C19-mediated drug interactions than omeprazole, making it preferred with clopidogrel.",
  },
  {
    title: "Omeprazole 20mg Capsules",
    generic_name: "Omeprazole",
    brand_name: "Omez 20",
    manufacturer: "Dr. Reddy's Laboratories",
    drug_schedule: "OTC",
    dosage_form: "capsule",
    strength: "20mg",
    pack_size: "10 capsules",
    composition: "Omeprazole IP 20mg (Enteric Coated Pellets)",
    therapeutic_category: "Gastrointestinal",
    price: 30,
    requires_prescription: false,
    storage_conditions: "Store below 25°C, protected from moisture and light.",
    indications:
      "Gastro-oesophageal reflux disease, peptic ulcer disease, NSAID-induced gastropathy prophylaxis, dyspepsia, H. pylori eradication (combination therapy), Zollinger-Ellison syndrome.",
    contraindications:
      "Known hypersensitivity to omeprazole or other benzimidazoles. Concomitant nelfinavir. Use with caution in hepatic impairment.",
    side_effects:
      "Common: headache, abdominal pain, nausea, diarrhoea, constipation, flatulence. Long-term risks: hypomagnesaemia, vitamin B12 deficiency, increased Clostridioides difficile infection risk, bone fractures, fundic gland polyps.",
    drug_interactions:
      "Reduces clopidogrel activation (CYP2C19 inhibition — prefer pantoprazole). Reduces absorption of ketoconazole and iron. Increases diazepam, phenytoin, and warfarin levels. Avoid with atazanavir.",
    dosage_instructions:
      "Take 20mg once daily before breakfast. Swallow capsule whole or open and sprinkle pellets on apple sauce (do not chew pellets). For H. pylori: 20mg twice daily with antibiotics.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Omeprazole was the first proton pump inhibitor and remains one of the most widely used acid suppressants. It was the world's best-selling drug for many years. Available OTC in India for short-term relief of heartburn and acid reflux symptoms.",
  },
  {
    title: "Ranitidine 150mg Tablets",
    generic_name: "Ranitidine Hydrochloride",
    brand_name: "Zinetac 150",
    manufacturer: "GlaxoSmithKline Pharmaceuticals",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "150mg",
    pack_size: "10 tablets",
    composition: "Ranitidine Hydrochloride IP equivalent to Ranitidine 150mg",
    therapeutic_category: "Gastrointestinal",
    price: 25,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from light and moisture.",
    indications:
      "Duodenal and gastric ulcers, GERD, Zollinger-Ellison syndrome, prevention of NSAID-induced ulcers, stress ulcer prophylaxis in critical care, acid aspiration prophylaxis before anaesthesia.",
    contraindications:
      "Known hypersensitivity to ranitidine. Acute porphyria. Note: NDMA contamination concerns led to temporary recalls; current formulations are NDMA-compliant.",
    side_effects:
      "Uncommon: headache, dizziness, diarrhoea, constipation. Rare: hepatitis, pancreatitis, blood dyscrasias (thrombocytopenia, leucopenia), bradycardia, gynaecomastia (with prolonged use), interstitial nephritis.",
    drug_interactions:
      "Reduces absorption of ketoconazole, itraconazole, atazanavir. May increase metformin absorption. High doses may affect warfarin metabolism. Antacids can reduce ranitidine absorption (take separately).",
    dosage_instructions:
      "Take 150mg twice daily (morning and bedtime) or 300mg at bedtime. For ulcer treatment: 4-8 weeks. For maintenance: 150mg at bedtime.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Ranitidine is an H2-receptor antagonist that competitively inhibits histamine-stimulated gastric acid secretion. While less potent than PPIs, it has a faster onset and fewer long-term concerns, making it suitable for intermittent acid suppression and on-demand heartburn relief.",
  },
  {
    title: "Domperidone 10mg Tablets",
    generic_name: "Domperidone",
    brand_name: "Domstal 10",
    manufacturer: "Torrent Pharmaceuticals",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "10mg",
    pack_size: "10 tablets",
    composition: "Domperidone IP 10mg",
    therapeutic_category: "Gastrointestinal",
    price: 35,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture.",
    indications:
      "Nausea and vomiting. Functional dyspepsia. Gastroparesis (diabetic and post-surgical). Nausea associated with dopamine agonist therapy (Parkinson disease). NOT recommended for chronic dyspepsia in cardiac patients.",
    contraindications:
      "Prolactinoma, concomitant QT-prolonging drugs, severe hepatic impairment, conditions where GI stimulation is dangerous (GI haemorrhage, obstruction, perforation), cardiac conditions predisposing to QT prolongation.",
    side_effects:
      "Uncommon: dry mouth, headache, diarrhoea, breast tenderness/galactorrhoea (due to prolactin elevation). Rare: QT prolongation and cardiac arrhythmias (especially at doses > 30mg/day or in elderly), extrapyramidal effects (very rare — does not readily cross blood-brain barrier).",
    drug_interactions:
      "CYP3A4 inhibitors (ketoconazole, erythromycin) — contraindicated (increased domperidone levels and QT risk). QT-prolonging drugs — contraindicated. Antacids and antisecretory agents reduce oral bioavailability.",
    dosage_instructions:
      "Take 10mg up to 3 times daily, 15-30 minutes before meals. Maximum: 30mg/day. Maximum duration: 7 days at the lowest effective dose. Avoid in patients > 60 years.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Domperidone is a peripheral dopamine D2 receptor antagonist that enhances gastric motility and has antiemetic effects via action on the chemoreceptor trigger zone. Unlike metoclopramide, it does not readily cross the blood-brain barrier, causing fewer central nervous system effects.",
  },
  {
    title: "Ondansetron 4mg Tablets",
    generic_name: "Ondansetron Hydrochloride",
    brand_name: "Emeset 4",
    manufacturer: "Cipla Limited",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "4mg",
    pack_size: "10 tablets",
    composition: "Ondansetron Hydrochloride Dihydrate IP equivalent to Ondansetron 4mg",
    therapeutic_category: "Gastrointestinal",
    price: 40,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from light and moisture.",
    indications:
      "Prevention and treatment of nausea and vomiting induced by chemotherapy, radiotherapy, and surgery. Post-operative nausea and vomiting. Severe vomiting in pregnancy (hyperemesis gravidarum — specialist use).",
    contraindications:
      "Known hypersensitivity to ondansetron. Congenital long QT syndrome. Concomitant apomorphine (severe hypotension). Caution in hepatic impairment (reduce dose).",
    side_effects:
      "Common: headache, constipation, flushing/warmth sensation. Uncommon: hiccups, hypotension, bradycardia, QT prolongation. Rare: transient visual disturbances, extrapyramidal reactions, anaphylaxis, serotonin syndrome (with serotonergic drugs).",
    drug_interactions:
      "Apomorphine — contraindicated (hypotension). CYP3A4 inducers (rifampicin, phenytoin) reduce ondansetron levels. Serotonergic drugs (SSRIs, tramadol) — risk of serotonin syndrome. QT-prolonging drugs — additive cardiac risk.",
    dosage_instructions:
      "Nausea/vomiting: 4-8mg 2-3 times daily. Chemotherapy: 8mg 30 minutes before, then 8mg every 12 hours for 1-2 days. Post-operative: 4mg at induction. Maximum: 16mg/dose, 32mg/day.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Ondansetron is a selective 5-HT3 receptor antagonist and one of the most effective antiemetic agents available. It blocks serotonin receptors both peripherally on vagal nerve terminals and centrally in the chemoreceptor trigger zone, without causing sedation or extrapyramidal effects.",
  },
  {
    title: "Loperamide 2mg Capsules",
    generic_name: "Loperamide Hydrochloride",
    brand_name: "Eldoper 2",
    manufacturer: "Elder Pharmaceuticals",
    drug_schedule: "OTC",
    dosage_form: "capsule",
    strength: "2mg",
    pack_size: "10 capsules",
    composition: "Loperamide Hydrochloride IP 2mg",
    therapeutic_category: "Gastrointestinal",
    price: 20,
    requires_prescription: false,
    storage_conditions: "Store below 30°C, protected from moisture.",
    indications:
      "Symptomatic treatment of acute non-specific diarrhoea. Chronic diarrhoea associated with inflammatory bowel disease. Ileostomy management — to reduce volume and frequency of stool output.",
    contraindications:
      "Children under 4 years, acute dysentery (bloody diarrhoea with fever), acute ulcerative colitis, antibiotic-associated colitis (C. difficile), bacterial enterocolitis caused by invasive organisms (Salmonella, Shigella), abdominal distension.",
    side_effects:
      "Uncommon: constipation, abdominal cramps, nausea, dizziness, dry mouth. Rare: paralytic ileus, abdominal distension, toxic megacolon (in ulcerative colitis), urinary retention, skin reactions.",
    drug_interactions:
      "CYP3A4 and P-glycoprotein inhibitors (itraconazole, ritonavir) may increase loperamide levels. Avoid with drugs that slow GI motility (opioids, anticholinergics). Cholestyramine may reduce absorption.",
    dosage_instructions:
      "Initial: 4mg (2 capsules), then 2mg after each loose stool. Maximum: 16mg/day. For acute diarrhoea: do not use for more than 48 hours without medical advice. Stay well hydrated.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Loperamide is a synthetic opioid analogue that acts on mu-opioid receptors in the gut wall to slow intestinal motility and reduce secretion. At therapeutic doses, it does not cross the blood-brain barrier and has no analgesic or CNS effects, making it safe for OTC use.",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  RESPIRATORY (4 products)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    title: "Montelukast 10mg Tablets",
    generic_name: "Montelukast Sodium",
    brand_name: "Montair 10",
    manufacturer: "Cipla Limited",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "10mg",
    pack_size: "10 tablets",
    composition: "Montelukast Sodium IP equivalent to Montelukast 10mg",
    therapeutic_category: "Respiratory",
    price: 65,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from light and moisture.",
    indications:
      "Prophylaxis and chronic treatment of asthma (add-on to inhaled corticosteroids). Prevention of exercise-induced bronchoconstriction. Seasonal and perennial allergic rhinitis.",
    contraindications:
      "Known hypersensitivity to montelukast. Not for treatment of acute asthma attacks. Caution in patients with neuropsychiatric symptoms.",
    side_effects:
      "Common: headache, abdominal pain, thirst. Uncommon: sleep disturbances, dream abnormalities, dizziness, elevated liver enzymes. Rare: neuropsychiatric events (agitation, aggression, depression, suicidal ideation — FDA black box warning), Churg-Strauss syndrome, hepatitis.",
    drug_interactions:
      "CYP3A4 and CYP2C8 inducers (phenobarbital, rifampicin) may reduce levels. Generally well tolerated with most asthma medications. No dose adjustment needed with theophylline. Prednisone dose can be tapered when montelukast is added.",
    dosage_instructions:
      "Adults: 10mg once daily in the evening. For allergic rhinitis: take at any time of day. For exercise-induced bronchoconstriction: take 2 hours before exercise. Continue even when asymptomatic.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Montelukast is a leukotriene receptor antagonist that blocks CysLT1 receptors, reducing bronchoconstriction, airway inflammation, and mucus secretion. It is particularly useful as add-on therapy in asthma patients not fully controlled on inhaled corticosteroids alone, and for concurrent allergic rhinitis.",
  },
  {
    title: "Cetirizine 10mg Tablets",
    generic_name: "Cetirizine Dihydrochloride",
    brand_name: "Cetzine 10",
    manufacturer: "Dr. Reddy's Laboratories",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "10mg",
    pack_size: "10 tablets",
    composition: "Cetirizine Dihydrochloride IP 10mg",
    therapeutic_category: "Respiratory",
    price: 15,
    requires_prescription: false,
    storage_conditions: "Store below 30°C, protected from moisture.",
    indications:
      "Seasonal and perennial allergic rhinitis. Chronic idiopathic urticaria. Allergic conjunctivitis. Pruritus associated with allergic conditions.",
    contraindications:
      "Known hypersensitivity to cetirizine, hydroxyzine, or piperazine derivatives. Severe renal impairment (GFR < 10 mL/min). Caution in epilepsy and patients prone to urinary retention.",
    side_effects:
      "Common: drowsiness (less than first-generation antihistamines), headache, dry mouth, fatigue. Uncommon: GI disturbances, dizziness, pharyngitis. Rare: anaphylaxis, aggression, hepatitis, thrombocytopenia.",
    drug_interactions:
      "CNS depressants and alcohol — additive sedation. Theophylline may slightly increase cetirizine levels. No significant CYP interactions. Ritonavir may increase cetirizine exposure.",
    dosage_instructions:
      "Adults and children > 12 years: 10mg once daily, preferably in the evening. In renal impairment: 5mg once daily. May be taken with or without food.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Cetirizine is a second-generation antihistamine (H1 receptor antagonist) that provides effective relief from allergic symptoms with less sedation than first-generation antihistamines. It is one of the most widely used OTC allergy medicines in India.",
  },
  {
    title: "Levocetirizine 5mg Tablets",
    generic_name: "Levocetirizine Dihydrochloride",
    brand_name: "Xyzal 5",
    manufacturer: "Glenmark Pharmaceuticals",
    drug_schedule: "OTC",
    dosage_form: "tablet",
    strength: "5mg",
    pack_size: "10 tablets",
    composition: "Levocetirizine Dihydrochloride IP 5mg",
    therapeutic_category: "Respiratory",
    price: 25,
    requires_prescription: false,
    storage_conditions: "Store below 30°C, protected from moisture.",
    indications:
      "Seasonal and perennial allergic rhinitis. Chronic idiopathic urticaria. Allergic dermatitis. Allergic conjunctivitis.",
    contraindications:
      "Known hypersensitivity to levocetirizine, cetirizine, or piperazine derivatives. End-stage renal disease (GFR < 10 mL/min). Children under 2 years.",
    side_effects:
      "Common: somnolence (less than cetirizine), headache, dry mouth, fatigue. Uncommon: nausea, visual disturbances, palpitations, weight gain. Rare: anaphylaxis, hepatitis, convulsions.",
    drug_interactions:
      "CNS depressants and alcohol: additive sedation. Ritonavir may increase levels. No significant CYP-mediated interactions. Theophylline may slightly reduce clearance.",
    dosage_instructions:
      "Adults: 5mg once daily in the evening. Children 6-12 years: 2.5mg once daily. Take at the same time each day. May be taken with or without food.",
    is_chronic: false,
    habit_forming: false,
    description:
      "Levocetirizine is the active R-enantiomer of cetirizine, offering equivalent antihistaminic efficacy at half the dose with potentially less sedation. It has higher affinity for the H1 receptor and a favourable pharmacokinetic profile with rapid onset of action.",
  },
  {
    title: "Salbutamol 4mg Tablets",
    generic_name: "Salbutamol Sulphate",
    brand_name: "Asthalin 4",
    manufacturer: "Cipla Limited",
    drug_schedule: "H",
    dosage_form: "tablet",
    strength: "4mg",
    pack_size: "10 tablets",
    composition: "Salbutamol Sulphate IP equivalent to Salbutamol 4mg",
    therapeutic_category: "Respiratory",
    price: 20,
    requires_prescription: true,
    storage_conditions: "Store below 30°C, protected from moisture and light.",
    indications:
      "Bronchospasm in bronchial asthma, chronic obstructive pulmonary disease (COPD), and reversible airways obstruction. Prophylaxis of exercise-induced bronchospasm. Note: inhaled route is preferred for most indications.",
    contraindications:
      "Known hypersensitivity to salbutamol. Caution in hyperthyroidism, cardiovascular disease, hypertension, diabetes mellitus, hypertrophic cardiomyopathy.",
    side_effects:
      "Common: tremor (dose-related), headache, tachycardia, palpitations. Uncommon: muscle cramps, insomnia, nervousness, hypokalaemia. Rare: paradoxical bronchospasm, cardiac arrhythmias, urticaria.",
    drug_interactions:
      "Beta-blockers antagonise bronchodilator effect (avoid non-selective beta-blockers in asthma). Diuretics may worsen hypokalaemia. MAO inhibitors and tricyclic antidepressants may potentiate cardiovascular effects. Corticosteroids and xanthines may worsen hypokalaemia.",
    dosage_instructions:
      "Adults: 2-4mg three to four times daily. Start with 2mg if sensitive to beta-agonists. Elderly and hepatically impaired: start with 2mg. Maximum: 8mg four times daily.",
    is_chronic: true,
    habit_forming: false,
    description:
      "Salbutamol is a short-acting beta-2 adrenergic receptor agonist (SABA) that relaxes bronchial smooth muscle, providing rapid relief of bronchospasm. While inhalation is the preferred route, oral tablets may be used when inhalers are impractical or as adjunct therapy in moderate-severe cases.",
  },
]

// ────────────────────────────────────────────────────────────────────────────
// Main Migration
// ────────────────────────────────────────────────────────────────────────────

const SEED_SOURCE = "suprameds-seed"
const DEFAULT_STOCK = 100

export default async function productCatalog({
  container,
}: {
  container: MedusaContainer
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info(`Starting product catalog seed (${PRODUCTS.length} products)...`)

  // ── Step 0: Resolve prerequisites ─────────────────────────────────────

  const salesChannelService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  ) as any
  const [defaultSalesChannel] = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel?.id) {
    logger.warn("Default Sales Channel not found — run base seed first. Skipping.")
    return
  }

  const fulfillmentService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  ) as any
  const [shippingProfile] = await fulfillmentService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfile?.id) {
    logger.warn("No default shipping profile found. Skipping.")
    return
  }

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = (stockLocations as any[])?.[0]
  if (!stockLocation?.id) {
    logger.warn("No stock location found. Skipping.")
    return
  }
  logger.info(`Using stock location: ${stockLocation.name} (${stockLocation.id})`)

  // ── Step 1: Delete existing seeded products (idempotent) ──────────────

  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "metadata"],
  })

  const seededProductIds = (existingProducts as any[])
    .filter((p: any) => p?.metadata?.source === SEED_SOURCE)
    .map((p: any) => p.id)

  if (seededProductIds.length) {
    logger.info(`Deleting ${seededProductIds.length} existing seeded products...`)

    // Delete drug metadata first
    const pharmaService = container.resolve(PHARMA_MODULE) as any
    for (const productId of seededProductIds) {
      try {
        const existing = await pharmaService.listDrugProducts(
          { product_id: productId },
          { take: 1 }
        )
        if (existing?.length) {
          await pharmaService.deleteDrugProducts(existing[0].id)
        }
      } catch (e: any) {
        logger.warn(`Could not delete drug metadata for product ${productId}: ${e.message}`)
      }
    }

    // Delete batches for these products
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const _listBatches = (batchService.listBatches ?? batchService.listBatchs)?.bind(batchService)
    const _deleteBatches = (batchService.deleteBatches ?? batchService.deleteBatchs)?.bind(batchService)
    if (_listBatches && _deleteBatches) {
      for (const productId of seededProductIds) {
        try {
          const batches = await _listBatches({ product_id: productId }, { take: 100 })
          for (const batch of batches ?? []) {
            try {
              await _deleteBatches(batch.id)
            } catch {
              // Ignore individual batch deletion failures
            }
          }
        } catch {
          // Ignore — product may not have batches
        }
      }
    }

    // Delete products (this cascades to variants, prices, inventory links)
    try {
      await deleteProductsWorkflow(container).run({
        input: { ids: seededProductIds },
      })
      logger.info(`Deleted ${seededProductIds.length} existing seeded products.`)
    } catch (e: any) {
      logger.warn(`Error deleting some products — continuing: ${e.message}`)
    }
  }

  // ── Step 2: Create products via workflow ───────────────────────────────

  logger.info(`Creating ${PRODUCTS.length} products...`)

  const productInputs = PRODUCTS.map((p) => ({
    title: p.title,
    handle: slugify(p.title),
    subtitle: p.therapeutic_category,
    description: p.description,
    status: "published" as const,
    is_giftcard: false,
    sales_channels: [{ id: defaultSalesChannel.id }],
    shipping_profile_id: shippingProfile.id,
    options: [{ title: "Pack", values: ["default"] }],
    variants: [
      {
        title: `${p.dosage_form.charAt(0).toUpperCase() + p.dosage_form.slice(1)} ${p.strength}`,
        sku: makeSku(p.title),
        manage_inventory: true,
        allow_backorder: false,
        options: { Pack: "default" },
        prices: [
          {
            currency_code: "inr",
            amount: p.price,
          },
        ],
      },
    ],
    metadata: {
      source: SEED_SOURCE,
      therapeutic_category: p.therapeutic_category,
    },
  }))

  const { result: createdProducts } = await createProductsWorkflow(container).run({
    input: { products: productInputs },
  })

  logger.info(`Created ${createdProducts.length} products.`)

  // ── Step 3: Create drug metadata via pharmaService ────────────────────

  logger.info("Creating drug metadata...")

  const pharmaService = container.resolve(PHARMA_MODULE) as any

  const drugMetadataInputs = createdProducts.map((product: any) => {
    const def = PRODUCTS.find((p) => slugify(p.title) === product.handle)
    if (!def) {
      throw new Error(`Missing product definition for created product "${product.title}"`)
    }

    return {
      product_id: product.id,
      schedule: def.drug_schedule,
      generic_name: def.generic_name,
      therapeutic_class: def.therapeutic_category,
      dosage_form: def.dosage_form,
      strength: def.strength,
      composition: def.composition,
      pack_size: def.pack_size,
      unit_type: "strip" as const,
      gst_rate: 5,
      indications: def.indications,
      contraindications: def.contraindications,
      side_effects: def.side_effects,
      drug_interactions: def.drug_interactions,
      storage_instructions: def.storage_conditions,
      dosage_instructions: def.dosage_instructions,
      is_chronic: def.is_chronic,
      habit_forming: def.habit_forming,
      is_narcotic: false,
      requires_refrigeration: false,
      metadata: {
        source: SEED_SOURCE,
        brand_name: def.brand_name,
        manufacturer: def.manufacturer,
      } as any,
    }
  })

  await pharmaService.createDrugProducts(drugMetadataInputs)
  logger.info(`Created drug metadata for ${drugMetadataInputs.length} products.`)

  // ── Step 4: Create inventory items, levels, and variant links ─────────

  logger.info("Creating inventory items and stock levels...")

  // Gather all variants from created products
  const createdProductIds = createdProducts.map((p: any) => p.id).filter(Boolean)
  const { data: allVariants } = await query.graph({
    entity: "variant",
    fields: ["id", "sku", "product_id"],
    filters: { product_id: createdProductIds },
  })

  const variants = (allVariants as any[]).filter((v) => v?.sku)
  const skus = variants.map((v) => v.sku)

  // Check for existing inventory items (in case of partial runs)
  const { data: existingInvItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: { sku: skus },
  })
  const invBySku = new Map<string, any>(
    (existingInvItems as any[]).filter((i) => i?.sku).map((i) => [i.sku, i])
  )

  // Create missing inventory items
  const missingSkus = skus.filter((s) => !invBySku.has(s))
  if (missingSkus.length) {
    const { result: createdInvItems } = await createInventoryItemsWorkflow(container).run({
      input: {
        items: missingSkus.map((sku) => {
          const variant = variants.find((v) => v.sku === sku)
          const product = createdProducts.find((p: any) => p.id === variant?.product_id)
          return { sku, title: product?.title ?? sku }
        }) as any,
      },
    })
    for (const item of createdInvItems as any[]) {
      if (item?.sku) invBySku.set(item.sku, item)
    }
  }

  // Create inventory levels at the stock location
  const invItemIds = skus.map((s) => invBySku.get(s)?.id).filter(Boolean)
  const { data: existingLevels } = await query.graph({
    entity: "inventory_levels",
    fields: ["id", "inventory_item_id", "location_id"],
    filters: { inventory_item_id: invItemIds, location_id: [stockLocation.id] },
  })
  const levelMap = new Map<string, string>(
    (existingLevels as any[]).map((l) => [`${l.inventory_item_id}:${l.location_id}`, l.id])
  )

  const creates: any[] = []
  const updates: any[] = []
  for (const id of invItemIds) {
    const key = `${id}:${stockLocation.id}`
    const existing = levelMap.get(key)
    if (existing) {
      updates.push({
        id: existing,
        inventory_item_id: id,
        location_id: stockLocation.id,
        stocked_quantity: DEFAULT_STOCK,
      })
    } else {
      creates.push({
        inventory_item_id: id,
        location_id: stockLocation.id,
        stocked_quantity: DEFAULT_STOCK,
      })
    }
  }

  if (creates.length || updates.length) {
    await batchInventoryItemLevelsWorkflow(container).run({
      input: { creates, updates, deletes: [] } as any,
    })
  }

  // Link variants to inventory items
  const link = container.resolve(ContainerRegistrationKeys.LINK) as any
  const linkDefs = variants
    .filter((v) => v?.sku && invBySku.get(v.sku)?.id)
    .map((v) => ({
      [Modules.PRODUCT]: { variant_id: v.id },
      [Modules.INVENTORY]: { inventory_item_id: invBySku.get(v.sku).id },
    }))

  if (linkDefs.length) {
    await link.create(linkDefs as any)
  }

  logger.info(
    `Inventory setup complete: ${invItemIds.length} items, ${creates.length} new levels, ${updates.length} updated levels, ${linkDefs.length} variant links.`
  )

  // ── Step 5: Create pharma batches (2 per variant) ─────────────────────

  logger.info("Creating pharma batches...")

  const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
  const _createBatches = (batchService.createBatches ?? batchService.createBatchs)?.bind(batchService)

  if (!_createBatches) {
    logger.warn("Batch service createBatches method not found — skipping batch creation.")
    return
  }

  let totalBatches = 0

  for (const product of createdProducts as any[]) {
    const def = PRODUCTS.find((p) => slugify(p.title) === product.handle)
    if (!def) continue

    const productVariants = variants.filter((v) => v.product_id === product.id)

    for (const variant of productVariants) {
      const sku = variant.sku || "UNKNOWN"
      const mrpPaise = Math.round(def.price * 100)
      const costPricePaise = Math.round(def.price * 0.4 * 100)

      // Batch A: older, manufactured 6 months ago, expires in 18 months
      try {
        await _createBatches({
          product_variant_id: variant.id,
          product_id: product.id,
          lot_number: `LOT-${sku}-A`,
          batch_mrp_paise: mrpPaise,
          purchase_price_paise: costPricePaise,
          manufactured_on: monthsAgo(6),
          expiry_date: monthsFromNow(18),
          received_quantity: 50,
          available_quantity: 50,
          reserved_quantity: 0,
          location_id: stockLocation.id,
          supplier_name: def.manufacturer,
          grn_number: `GRN-SEED-${String(totalBatches + 1).padStart(4, "0")}`,
          received_on: monthsAgo(5),
          status: "active",
          metadata: { source: SEED_SOURCE },
        })
        totalBatches++
      } catch (e: any) {
        logger.warn(`Failed to create batch A for ${sku}: ${e.message}`)
      }

      // Batch B: newer, manufactured 3 months ago, expires in 12 months
      try {
        await _createBatches({
          product_variant_id: variant.id,
          product_id: product.id,
          lot_number: `LOT-${sku}-B`,
          batch_mrp_paise: mrpPaise,
          purchase_price_paise: costPricePaise,
          manufactured_on: monthsAgo(3),
          expiry_date: monthsFromNow(12),
          received_quantity: 50,
          available_quantity: 50,
          reserved_quantity: 0,
          location_id: stockLocation.id,
          supplier_name: def.manufacturer,
          grn_number: `GRN-SEED-${String(totalBatches + 1).padStart(4, "0")}`,
          received_on: monthsAgo(2),
          status: "active",
          metadata: { source: SEED_SOURCE },
        })
        totalBatches++
      } catch (e: any) {
        logger.warn(`Failed to create batch B for ${sku}: ${e.message}`)
      }
    }
  }

  logger.info(`Created ${totalBatches} pharma batches.`)

  // ── Done ──────────────────────────────────────────────────────────────

  logger.info(
    `Product catalog seed complete: ${createdProducts.length} products, ${invItemIds.length} inventory items, ${totalBatches} batches.`
  )
}
