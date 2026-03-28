import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import {
  batchInventoryItemLevelsWorkflow,
  createCollectionsWorkflow,
  createInventoryItemsWorkflow,
  createProductsWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { PHARMA_MODULE } from "../modules/pharma"

/* ──────────────────────────────────────────────────────────────────────────
 * 008 — Seed 20 realistic generic medicines across 6 therapeutic categories
 *
 * Each product includes:
 *   • Full clinical data (indications, side effects, interactions, dosage)
 *   • MRP + selling price at 50-80% off for visible discount badges
 *   • Rich metadata (Tata 1mg style): safety advice, fact box, tips, FAQs
 *
 * Idempotent: deletes then re-creates on every run.
 * ────────────────────────────────────────────────────────────────────────── */

type SafetyRating = "safe" | "caution" | "unsafe"

type SafetyEntry = { rating: SafetyRating; note: string }

type ProductSeed = {
  brand_name: string
  composition: string
  generic_name: string
  dosage_form: "tablet" | "capsule" | "syrup"
  strength: string | null
  schedule: "OTC" | "H" | "H1"
  therapeutic_class: string
  /** Selling price in whole INR */
  price: number
  /** MRP in whole INR (for discount calculation) */
  mrp: number
  pack_size: string
  unit_type: "strip" | "bottle"
  description: string
  indications: string
  contraindications: string
  side_effects: string
  drug_interactions: string
  dosage_instructions: string
  storage_instructions: string
  habit_forming: boolean
  is_chronic: boolean
  is_narcotic: boolean
  requires_refrigeration: boolean
  gst_rate: number
  tags: string[]
  // Rich metadata (Tata 1mg inspired)
  manufacturer: string
  chemical_class: string
  action_class: string
  safety_advice: {
    pregnancy: SafetyEntry
    breastfeeding: SafetyEntry
    alcohol: SafetyEntry
    driving: SafetyEntry
    kidney: SafetyEntry
    liver: SafetyEntry
  }
  quick_tips: string[]
  faqs: { q: string; a: string }[]
  references: string[]
}

const PRODUCTS: ProductSeed[] = [
  // ═══════════════════════════════════════════
  //  DIABETES (5 products)
  // ═══════════════════════════════════════════
  {
    brand_name: "METCYN 500 SR",
    composition: "Metformin Hydrochloride 500mg (Sustained Release)",
    generic_name: "Metformin",
    dosage_form: "tablet",
    strength: "500mg",
    schedule: "H",
    therapeutic_class: "Antidiabetic",
    price: 72,
    mrp: 180,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "METCYN 500 SR contains Metformin, the first-line treatment for type 2 diabetes. It works by reducing glucose production in the liver and improving insulin sensitivity. The sustained-release formulation minimises gastrointestinal side effects.",
    indications:
      "Type 2 diabetes mellitus — as monotherapy when diet and exercise alone are inadequate, or in combination with other antidiabetic agents including insulin.",
    contraindications:
      "Diabetic ketoacidosis, severe renal impairment (eGFR < 30 mL/min), acute conditions with potential for tissue hypoxia (e.g. cardiac/respiratory failure, recent MI), hepatic insufficiency, acute alcohol intoxication.",
    side_effects:
      "Common: nausea, vomiting, diarrhoea, abdominal pain, loss of appetite. Uncommon: metallic taste. Rare: lactic acidosis (seek emergency care if muscle pain, weakness, breathing difficulty occur). Long-term: vitamin B12 deficiency.",
    drug_interactions:
      "Alcohol increases lactic acidosis risk. Iodinated contrast media — discontinue 48 hrs before and after procedure. Cimetidine may increase metformin levels. ACE inhibitors may enhance hypoglycaemic effect.",
    dosage_instructions:
      "Take with or immediately after meals to reduce GI upset. Swallow whole — do not crush or chew SR tablets. Start 500 mg once daily, increase gradually as directed by physician. Maximum 2000 mg/day.",
    storage_instructions:
      "Store below 30°C in a dry place. Protect from moisture. Keep out of reach of children.",
    habit_forming: false,
    is_chronic: true,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["diabetes", "metformin", "blood sugar", "type 2 diabetes", "antidiabetic"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Biguanide",
    action_class: "Insulin sensitizer — decreases hepatic glucose output and improves peripheral glucose uptake",
    safety_advice: {
      pregnancy: { rating: "unsafe", note: "Metformin crosses the placenta. Insulin is preferred for managing diabetes in pregnancy. Consult your doctor." },
      breastfeeding: { rating: "caution", note: "Small amounts pass into breast milk. Generally considered compatible but monitor the infant for hypoglycaemia." },
      alcohol: { rating: "unsafe", note: "Increases the risk of lactic acidosis significantly. Avoid alcohol consumption while on metformin." },
      driving: { rating: "safe", note: "Does not usually affect ability to drive. However, be cautious if combined with other drugs that lower blood sugar." },
      kidney: { rating: "caution", note: "Contraindicated if eGFR < 30. Dose adjustment required for eGFR 30–45. Monitor renal function regularly." },
      liver: { rating: "caution", note: "Avoid in patients with severe hepatic impairment due to risk of lactic acidosis." },
    },
    quick_tips: [
      "Take with food to reduce stomach upset",
      "Do not crush or chew sustained-release tablets",
      "Have your kidney function checked at least once a year",
      "Report any unusual muscle pain or breathing difficulty immediately",
      "Vitamin B12 levels should be monitored during long-term use",
    ],
    faqs: [
      { q: "Can I take METCYN 500 SR on an empty stomach?", a: "It is best taken with or immediately after food to minimise nausea and diarrhoea. The SR formulation already reduces GI side effects compared to regular metformin." },
      { q: "How long does it take to see results?", a: "Blood sugar levels begin to improve within 1-2 weeks, but full effect is seen at 2-3 months. HbA1c should be checked after 3 months." },
      { q: "Can I drink alcohol while taking this?", a: "Alcohol should be avoided as it significantly increases the risk of lactic acidosis, a serious condition." },
      { q: "Is metformin a lifetime medication?", a: "Many patients take metformin long-term. Lifestyle changes (diet, exercise, weight loss) may reduce the dose needed. Never stop without consulting your doctor." },
    ],
    references: ["Indian Pharmacopoeia 2021", "API Consensus Guidelines for T2DM 2020", "CDSCO Approved Prescribing Information"],
  },
  {
    brand_name: "METCYN 1000 SR",
    composition: "Metformin Hydrochloride 1000mg (Sustained Release)",
    generic_name: "Metformin",
    dosage_form: "tablet",
    strength: "1000mg",
    schedule: "H",
    therapeutic_class: "Antidiabetic",
    price: 112,
    mrp: 320,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "METCYN 1000 SR is a higher-strength sustained release metformin for patients requiring intensified glycaemic control. The SR matrix provides extended drug release over 8-10 hours, reducing dosing frequency and GI side effects.",
    indications: "Type 2 diabetes mellitus requiring higher dose metformin therapy, as monotherapy or add-on to other antidiabetics.",
    contraindications: "Diabetic ketoacidosis, severe renal impairment (eGFR < 30), tissue hypoxia, hepatic failure, acute alcohol intoxication, pregnancy.",
    side_effects: "Common: nausea, diarrhoea, bloating. Uncommon: metallic taste, vitamin B12 deficiency. Rare: lactic acidosis.",
    drug_interactions: "Alcohol (lactic acidosis risk), iodinated contrast, cimetidine, ACE inhibitors, diuretics.",
    dosage_instructions: "Take once or twice daily with meals. Swallow whole. Do not exceed 2000 mg/day. Titrate gradually over 2-4 weeks.",
    storage_instructions: "Store below 30°C. Protect from moisture.",
    habit_forming: false,
    is_chronic: true,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["diabetes", "metformin", "blood sugar", "type 2 diabetes"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Biguanide",
    action_class: "Insulin sensitizer — decreases hepatic glucose output",
    safety_advice: {
      pregnancy: { rating: "unsafe", note: "Not recommended. Insulin is preferred in pregnancy." },
      breastfeeding: { rating: "caution", note: "Low amounts in breast milk. Monitor infant." },
      alcohol: { rating: "unsafe", note: "Significantly increases lactic acidosis risk." },
      driving: { rating: "safe", note: "Usually safe. Caution if hypoglycaemia occurs with combination therapy." },
      kidney: { rating: "caution", note: "Contraindicated if eGFR < 30. Adjust dose for eGFR 30-45." },
      liver: { rating: "caution", note: "Avoid in severe hepatic impairment." },
    },
    quick_tips: [
      "Take with the main meal of the day",
      "If switching from regular metformin, total daily dose stays the same",
      "Monitor kidney function annually",
    ],
    faqs: [
      { q: "What is the difference between METCYN 500 and 1000?", a: "METCYN 1000 provides twice the dose in a single tablet, reducing pill burden for patients who need higher doses." },
      { q: "Can I split the tablet?", a: "No. Sustained-release tablets must be swallowed whole to maintain proper drug release over time." },
    ],
    references: ["Indian Pharmacopoeia 2021", "RSSDI Clinical Practice Recommendations 2022"],
  },
  {
    brand_name: "GLIMCYN-M2 Tab",
    composition: "Glimepiride 2mg + Metformin Hydrochloride 500mg (SR)",
    generic_name: "Glimepiride + Metformin",
    dosage_form: "tablet",
    strength: "2mg/500mg",
    schedule: "H",
    therapeutic_class: "Antidiabetic",
    price: 135,
    mrp: 450,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "GLIMCYN-M2 is a fixed-dose combination of glimepiride (sulfonylurea) and metformin (biguanide). Glimepiride stimulates insulin release from pancreatic beta cells while metformin reduces hepatic glucose production. This dual action provides superior glycaemic control.",
    indications: "Type 2 diabetes mellitus when monotherapy with metformin or sulfonylurea alone is inadequate. Not for type 1 diabetes.",
    contraindications: "Type 1 diabetes, diabetic ketoacidosis, severe renal/hepatic impairment, G6PD deficiency, pregnancy and lactation.",
    side_effects: "Common: hypoglycaemia, nausea, diarrhoea, dizziness. Uncommon: weight gain, allergic skin reactions. Rare: blood dyscrasias, lactic acidosis.",
    drug_interactions: "NSAIDs, beta-blockers (may mask hypoglycaemia symptoms), fluconazole, alcohol, insulin (increased hypoglycaemia risk).",
    dosage_instructions: "Take once daily with breakfast. Start low and titrate. Always carry sugar/glucose for hypoglycaemia episodes.",
    storage_instructions: "Store below 25°C in a dry place. Protect from light.",
    habit_forming: false,
    is_chronic: true,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["diabetes", "glimepiride", "metformin", "combination", "blood sugar"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Sulfonylurea + Biguanide",
    action_class: "Insulin secretagogue + Insulin sensitizer — stimulates pancreatic insulin release and improves peripheral glucose uptake",
    safety_advice: {
      pregnancy: { rating: "unsafe", note: "Both components are contraindicated in pregnancy. Switch to insulin." },
      breastfeeding: { rating: "unsafe", note: "Glimepiride may cause hypoglycaemia in nursing infant. Not recommended." },
      alcohol: { rating: "unsafe", note: "Risk of severe hypoglycaemia and lactic acidosis. Strictly avoid." },
      driving: { rating: "caution", note: "May cause hypoglycaemia leading to dizziness. Keep glucose handy while driving." },
      kidney: { rating: "caution", note: "Dose adjustment required. Contraindicated in severe renal impairment." },
      liver: { rating: "caution", note: "Use with caution. May worsen hepatic function." },
    },
    quick_tips: [
      "Always take with breakfast to reduce hypoglycaemia risk",
      "Carry sugar packets or glucose tablets at all times",
      "Do not skip meals while on this medication",
      "Report symptoms of low blood sugar: sweating, tremors, confusion",
    ],
    faqs: [
      { q: "What should I do if I miss a dose?", a: "Take it as soon as you remember with food. Skip if close to next dose. Never double up." },
      { q: "Can this cause weight gain?", a: "Glimepiride may cause mild weight gain. Regular exercise and diet control help manage this." },
    ],
    references: ["API Consensus Guidelines for T2DM 2020", "CDSCO Approved Prescribing Information"],
  },
  {
    brand_name: "DAPACYN 10 Tab",
    composition: "Dapagliflozin 10mg",
    generic_name: "Dapagliflozin",
    dosage_form: "tablet",
    strength: "10mg",
    schedule: "H",
    therapeutic_class: "Antidiabetic",
    price: 200,
    mrp: 580,
    pack_size: "14 tablets",
    unit_type: "strip",
    description:
      "DAPACYN 10 contains Dapagliflozin, an SGLT2 inhibitor that works independently of insulin by blocking glucose reabsorption in the kidneys, causing excess glucose to be excreted in urine. It also provides cardiovascular and renal protective benefits.",
    indications: "Type 2 diabetes mellitus (alone or with other antidiabetics). Heart failure with reduced ejection fraction. Chronic kidney disease.",
    contraindications: "Type 1 diabetes, diabetic ketoacidosis, severe renal impairment (eGFR < 25 for diabetes indication), recurrent urinary tract infections.",
    side_effects: "Common: genital mycotic infections, urinary tract infections, increased urination. Uncommon: volume depletion, dizziness. Rare: diabetic ketoacidosis (even with normal glucose), Fournier's gangrene.",
    drug_interactions: "Loop diuretics (increased dehydration risk), insulin/sulfonylureas (increase hypoglycaemia — may need dose reduction).",
    dosage_instructions: "Take once daily, morning preferred, with or without food. Drink adequate water (2-3 litres/day). No dose adjustment for mild-moderate renal impairment.",
    storage_instructions: "Store below 30°C. No special storage requirements.",
    habit_forming: false,
    is_chronic: true,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["diabetes", "dapagliflozin", "SGLT2 inhibitor", "heart failure", "kidney protection"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "SGLT2 Inhibitor (Gliflozin)",
    action_class: "Sodium-glucose co-transporter 2 inhibitor — blocks renal glucose reabsorption, promoting glucosuria",
    safety_advice: {
      pregnancy: { rating: "unsafe", note: "Not recommended in pregnancy based on animal studies showing renal effects." },
      breastfeeding: { rating: "unsafe", note: "No human data. Not recommended during breastfeeding." },
      alcohol: { rating: "caution", note: "May increase risk of dehydration and ketoacidosis. Limit alcohol." },
      driving: { rating: "safe", note: "No significant effect on driving ability." },
      kidney: { rating: "caution", note: "Can be used down to eGFR 25 for diabetes. Monitor renal function." },
      liver: { rating: "safe", note: "No dose adjustment needed for hepatic impairment." },
    },
    quick_tips: [
      "Drink plenty of water (2-3 litres daily) to prevent dehydration",
      "Maintain good genital hygiene to prevent fungal infections",
      "Seek immediate medical help if you experience nausea, vomiting, or abdominal pain",
      "This medicine also has heart and kidney protective benefits",
    ],
    faqs: [
      { q: "Why do I urinate more on this medicine?", a: "Dapagliflozin works by removing excess glucose through urine, which increases urination. This is the intended mechanism." },
      { q: "Can this medicine protect my heart?", a: "Yes, dapagliflozin has proven cardiovascular benefits and is approved for heart failure treatment." },
    ],
    references: ["DAPA-HF Trial 2019", "DAPA-CKD Trial 2020", "CDSCO Approved Prescribing Information"],
  },
  {
    brand_name: "SITACYN-M Tab",
    composition: "Sitagliptin 50mg + Metformin 500mg",
    generic_name: "Sitagliptin + Metformin",
    dosage_form: "tablet",
    strength: "50mg/500mg",
    schedule: "H",
    therapeutic_class: "Antidiabetic",
    price: 186,
    mrp: 620,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "SITACYN-M combines sitagliptin (DPP-4 inhibitor) with metformin for enhanced blood sugar control. Sitagliptin increases incretin hormone levels, which stimulate insulin release and suppress glucagon. This combination is well-tolerated with low hypoglycaemia risk.",
    indications: "Type 2 diabetes mellitus when diet, exercise, and metformin alone are insufficient. As add-on or initial combination therapy.",
    contraindications: "Type 1 diabetes, history of pancreatitis, severe renal impairment (eGFR < 30), diabetic ketoacidosis.",
    side_effects: "Common: headache, nasopharyngitis, upper respiratory infection. Uncommon: pancreatitis (rare but serious), joint pain. GI effects from metformin component.",
    drug_interactions: "Digoxin (monitor levels), insulin/sulfonylureas (may need dose reduction). No significant CYP interactions.",
    dosage_instructions: "Take twice daily with meals. Swallow whole. If GI upset persists, take with a larger meal.",
    storage_instructions: "Store below 30°C. Protect from moisture.",
    habit_forming: false,
    is_chronic: true,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["diabetes", "sitagliptin", "metformin", "DPP-4 inhibitor", "blood sugar"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "DPP-4 Inhibitor + Biguanide",
    action_class: "Incretin enhancer + Insulin sensitizer — increases GLP-1 and GIP levels while reducing hepatic glucose output",
    safety_advice: {
      pregnancy: { rating: "unsafe", note: "Insufficient human data. Switch to insulin during pregnancy." },
      breastfeeding: { rating: "caution", note: "Sitagliptin is excreted in rat milk. Use with caution." },
      alcohol: { rating: "unsafe", note: "Increases lactic acidosis risk from metformin component." },
      driving: { rating: "safe", note: "No known effect on driving ability." },
      kidney: { rating: "caution", note: "Dose adjustment required for eGFR < 45. Contraindicated if eGFR < 30." },
      liver: { rating: "caution", note: "Use with caution in moderate hepatic impairment." },
    },
    quick_tips: [
      "Low risk of hypoglycaemia when used without sulfonylureas",
      "Report severe abdominal pain immediately (pancreatitis risk)",
      "Can be taken with or without food, but with meals reduces GI upset",
    ],
    faqs: [
      { q: "Does this cause weight gain?", a: "Sitagliptin is weight-neutral, and metformin may cause modest weight loss. This combination is unlikely to cause weight gain." },
      { q: "Is there a risk of pancreatitis?", a: "Rare cases reported. Seek immediate medical attention if severe, persistent abdominal pain occurs." },
    ],
    references: ["TECOS Cardiovascular Outcomes Trial", "CDSCO Approved Prescribing Information"],
  },

  // ═══════════════════════════════════════════
  //  HYPERTENSION (4 products)
  // ═══════════════════════════════════════════
  {
    brand_name: "TELCYN 40",
    composition: "Telmisartan 40mg",
    generic_name: "Telmisartan",
    dosage_form: "tablet",
    strength: "40mg",
    schedule: "H",
    therapeutic_class: "Antihypertensive",
    price: 105,
    mrp: 350,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "TELCYN 40 contains Telmisartan, an angiotensin II receptor blocker (ARB) that relaxes blood vessels and reduces blood pressure. It has the longest half-life among ARBs, providing consistent 24-hour BP control with once-daily dosing.",
    indications: "Essential hypertension. Cardiovascular risk reduction in patients unable to take ACE inhibitors. Diabetic nephropathy protection.",
    contraindications: "Pregnancy, bilateral renal artery stenosis, hyperkalaemia, severe hepatic impairment, concomitant use with aliskiren in diabetics.",
    side_effects: "Common: dizziness, back pain, sinusitis. Uncommon: hypotension, hyperkalaemia. Rare: angioedema, impaired renal function.",
    drug_interactions: "NSAIDs (reduce antihypertensive effect), potassium-sparing diuretics (hyperkalaemia risk), lithium (toxicity), digoxin (monitor levels).",
    dosage_instructions: "Take once daily, preferably at the same time. Can be taken with or without food. Do not stop abruptly.",
    storage_instructions: "Store below 30°C. Protect from moisture. Keep in original packaging.",
    habit_forming: false,
    is_chronic: true,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["hypertension", "blood pressure", "telmisartan", "ARB", "heart"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Angiotensin II Receptor Blocker (ARB)",
    action_class: "AT1 receptor antagonist — blocks angiotensin II from constricting blood vessels, reducing blood pressure",
    safety_advice: {
      pregnancy: { rating: "unsafe", note: "Can cause foetal injury and death. Discontinue immediately if pregnancy is detected." },
      breastfeeding: { rating: "caution", note: "Limited data. Alternative antihypertensives preferred." },
      alcohol: { rating: "caution", note: "May enhance blood pressure lowering effect, causing dizziness." },
      driving: { rating: "caution", note: "Dizziness may occur, especially during initial treatment. Caution advised." },
      kidney: { rating: "caution", note: "Monitor renal function and potassium. Avoid in bilateral renal artery stenosis." },
      liver: { rating: "caution", note: "Contraindicated in severe hepatic impairment. Lower dose for moderate." },
    },
    quick_tips: [
      "Take at the same time each day for consistent blood pressure control",
      "Rise slowly from sitting or lying to avoid dizziness",
      "Do not stop taking without consulting your doctor",
      "Limit salt intake for better blood pressure control",
    ],
    faqs: [
      { q: "How long before I see results?", a: "Blood pressure starts reducing within 1-2 weeks, with maximum effect at 4-8 weeks." },
      { q: "Can I take this with amlodipine?", a: "Yes, telmisartan + amlodipine is a common and effective combination for hypertension." },
    ],
    references: ["ONTARGET Trial 2008", "Indian Guidelines on Hypertension IV 2019"],
  },
  {
    brand_name: "AMLCYN 5",
    composition: "Amlodipine Besylate 5mg",
    generic_name: "Amlodipine",
    dosage_form: "tablet",
    strength: "5mg",
    schedule: "H",
    therapeutic_class: "Antihypertensive",
    price: 84,
    mrp: 280,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "AMLCYN 5 contains Amlodipine, a long-acting calcium channel blocker that relaxes blood vessels and improves blood flow. It is one of the most widely prescribed antihypertensives globally due to its efficacy and tolerability.",
    indications: "Hypertension, chronic stable angina, vasospastic (Prinzmetal's) angina.",
    contraindications: "Severe aortic stenosis, cardiogenic shock, unstable angina, significant aortic stenosis.",
    side_effects: "Common: peripheral oedema (ankle swelling), flushing, headache. Uncommon: palpitations, dizziness, fatigue, nausea. Rare: gum hypertrophy.",
    drug_interactions: "Simvastatin (limit to 20mg), CYP3A4 inhibitors (ketoconazole, itraconazole), beta-blockers (additive cardiac depression).",
    dosage_instructions: "Take once daily, morning or evening. Consistent timing important. Can be taken with or without food.",
    storage_instructions: "Store below 30°C. Protect from light and moisture.",
    habit_forming: false,
    is_chronic: true,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["hypertension", "blood pressure", "amlodipine", "calcium channel blocker", "angina"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Dihydropyridine Calcium Channel Blocker",
    action_class: "L-type calcium channel blocker — inhibits calcium influx into vascular smooth muscle, causing vasodilation",
    safety_advice: {
      pregnancy: { rating: "caution", note: "Limited data. Use only if benefit clearly outweighs risk. Labetalol/nifedipine preferred." },
      breastfeeding: { rating: "caution", note: "Excreted in breast milk. Monitor infant for hypotension." },
      alcohol: { rating: "caution", note: "May enhance blood pressure lowering effect." },
      driving: { rating: "caution", note: "Dizziness and fatigue may occur. Be cautious during initial therapy." },
      kidney: { rating: "safe", note: "No dose adjustment required. Safe in renal impairment." },
      liver: { rating: "caution", note: "Start with lower dose in severe hepatic impairment." },
    },
    quick_tips: [
      "Ankle swelling is common but not dangerous — elevate feet when resting",
      "Avoid grapefruit juice as it can increase drug levels",
      "Full blood pressure effect may take 1-2 weeks",
    ],
    faqs: [
      { q: "Why do my ankles swell?", a: "Amlodipine causes more dilation of arteries than veins, leading to fluid accumulation in ankles. This is dose-related and usually mild." },
      { q: "Morning or evening dose?", a: "Either is fine. Choose a time that helps you remember. Evening dosing may slightly reduce morning BP surge." },
    ],
    references: ["ALLHAT Trial 2002", "ASCOT-BPLA Trial 2005"],
  },
  {
    brand_name: "LOSCYN-H Tab",
    composition: "Losartan Potassium 50mg + Hydrochlorothiazide 12.5mg",
    generic_name: "Losartan + Hydrochlorothiazide",
    dosage_form: "tablet",
    strength: "50mg/12.5mg",
    schedule: "H",
    therapeutic_class: "Antihypertensive",
    price: 126,
    mrp: 420,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "LOSCYN-H combines Losartan (ARB) with Hydrochlorothiazide (thiazide diuretic) for enhanced blood pressure control. The ARB relaxes blood vessels while the diuretic reduces fluid volume, providing complementary antihypertensive mechanisms.",
    indications: "Hypertension not adequately controlled by losartan or HCTZ alone. Stroke risk reduction in hypertensive patients with LVH.",
    contraindications: "Pregnancy, anuria, sulfonamide hypersensitivity, severe renal impairment, refractory hypokalaemia/hyperuricaemia.",
    side_effects: "Common: dizziness, upper respiratory infection. Uncommon: hypotension, electrolyte imbalance, increased uric acid. Rare: angioedema.",
    drug_interactions: "NSAIDs, lithium, potassium supplements, ACE inhibitors (dual RAAS blockade — avoid).",
    dosage_instructions: "Take once daily, preferably in the morning. Stay hydrated. Avoid excessive sun exposure (HCTZ photosensitivity).",
    storage_instructions: "Store below 30°C. Protect from light.",
    habit_forming: false,
    is_chronic: true,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["hypertension", "blood pressure", "losartan", "HCTZ", "diuretic", "combination"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "ARB + Thiazide Diuretic",
    action_class: "Dual mechanism — AT1 receptor blockade plus sodium and water excretion via distal tubule",
    safety_advice: {
      pregnancy: { rating: "unsafe", note: "ARBs cause foetal toxicity. Discontinue immediately if pregnancy is detected." },
      breastfeeding: { rating: "caution", note: "HCTZ passes into breast milk. Not recommended during breastfeeding." },
      alcohol: { rating: "caution", note: "May worsen orthostatic hypotension." },
      driving: { rating: "caution", note: "Dizziness possible. Be cautious." },
      kidney: { rating: "caution", note: "Monitor electrolytes and renal function. Avoid in severe renal impairment." },
      liver: { rating: "caution", note: "Losartan requires hepatic metabolism. Use with caution." },
    },
    quick_tips: [
      "Take in the morning to avoid nighttime urination",
      "Apply sunscreen — HCTZ increases sun sensitivity",
      "Monitor potassium levels regularly",
    ],
    faqs: [
      { q: "Will this make me urinate more?", a: "Yes, the HCTZ component is a diuretic. Increased urination is expected, especially in the first few days." },
      { q: "Can I take potassium supplements?", a: "Generally not needed as losartan tends to retain potassium. Your doctor will monitor levels." },
    ],
    references: ["LIFE Study 2002", "CDSCO Approved Prescribing Information"],
  },
  {
    brand_name: "TELCYN-AM Tab",
    composition: "Telmisartan 40mg + Amlodipine 5mg",
    generic_name: "Telmisartan + Amlodipine",
    dosage_form: "tablet",
    strength: "40mg/5mg",
    schedule: "H",
    therapeutic_class: "Antihypertensive",
    price: 156,
    mrp: 520,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "TELCYN-AM combines two powerful antihypertensives — telmisartan (ARB) and amlodipine (CCB). This synergistic combination provides superior blood pressure reduction with the added benefit of reducing amlodipine-related ankle oedema.",
    indications: "Hypertension not adequately controlled by either component alone. Initial combination therapy in patients with markedly elevated BP.",
    contraindications: "Pregnancy, bilateral renal artery stenosis, severe aortic stenosis, cardiogenic shock.",
    side_effects: "Common: peripheral oedema (less than amlodipine alone), dizziness. Uncommon: hypotension, fatigue. Rare: angioedema.",
    drug_interactions: "NSAIDs, potassium-sparing diuretics, simvastatin (limit dose), CYP3A4 inhibitors.",
    dosage_instructions: "Take once daily at the same time. Can be taken with or without food.",
    storage_instructions: "Store below 30°C.",
    habit_forming: false,
    is_chronic: true,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["hypertension", "blood pressure", "telmisartan", "amlodipine", "combination"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "ARB + Calcium Channel Blocker",
    action_class: "AT1 blockade + calcium channel inhibition — dual vasodilation through complementary pathways",
    safety_advice: {
      pregnancy: { rating: "unsafe", note: "Telmisartan is teratogenic. Contraindicated in pregnancy." },
      breastfeeding: { rating: "caution", note: "Both components may pass into breast milk." },
      alcohol: { rating: "caution", note: "Enhanced hypotensive effect." },
      driving: { rating: "caution", note: "Initial dizziness possible." },
      kidney: { rating: "caution", note: "Monitor renal function and electrolytes." },
      liver: { rating: "caution", note: "Start with lower dose component if hepatic impairment." },
    },
    quick_tips: [
      "This combination reduces ankle swelling compared to amlodipine alone",
      "Maintain consistent dosing time for 24-hour BP coverage",
    ],
    faqs: [
      { q: "Is this better than taking both medicines separately?", a: "The single tablet improves compliance and the combination may reduce side effects like ankle swelling." },
    ],
    references: ["AMADEO Trial 2008", "Indian Guidelines on Hypertension IV 2019"],
  },

  // ═══════════════════════════════════════════
  //  CARDIAC (3 products)
  // ═══════════════════════════════════════════
  {
    brand_name: "ATORCYN 10",
    composition: "Atorvastatin Calcium 10mg",
    generic_name: "Atorvastatin",
    dosage_form: "tablet",
    strength: "10mg",
    schedule: "H",
    therapeutic_class: "Cardiac",
    price: 135,
    mrp: 450,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "ATORCYN 10 contains Atorvastatin, the most potent statin for lowering LDL cholesterol. It inhibits HMG-CoA reductase enzyme in the liver, reducing cholesterol synthesis and increasing LDL receptor expression for greater cholesterol clearance.",
    indications: "Primary hypercholesterolaemia, mixed dyslipidaemia, prevention of cardiovascular events in high-risk patients, familial hypercholesterolaemia.",
    contraindications: "Active liver disease, unexplained persistent transaminase elevation, pregnancy, breastfeeding.",
    side_effects: "Common: headache, myalgia, GI disturbances. Uncommon: elevated liver enzymes, insomnia. Rare: rhabdomyolysis, hepatitis, memory impairment.",
    drug_interactions: "Cyclosporine, fibrates (rhabdomyolysis risk), warfarin (monitor INR), macrolide antibiotics, grapefruit juice (large quantities).",
    dosage_instructions: "Take once daily, anytime, with or without food. Evening dosing may be slightly more effective. Do not take with grapefruit.",
    storage_instructions: "Store below 30°C. Protect from moisture and light.",
    habit_forming: false,
    is_chronic: true,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["cholesterol", "statin", "atorvastatin", "heart", "lipid lowering", "cardiac"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "HMG-CoA Reductase Inhibitor (Statin)",
    action_class: "Competitive inhibitor of HMG-CoA reductase — rate-limiting enzyme in hepatic cholesterol synthesis",
    safety_advice: {
      pregnancy: { rating: "unsafe", note: "Statins are contraindicated in pregnancy. Cholesterol is essential for foetal development." },
      breastfeeding: { rating: "unsafe", note: "Contraindicated during breastfeeding." },
      alcohol: { rating: "caution", note: "Heavy alcohol use increases liver toxicity risk." },
      driving: { rating: "safe", note: "No significant effect on driving ability." },
      kidney: { rating: "safe", note: "No dose adjustment required for renal impairment." },
      liver: { rating: "caution", note: "Contraindicated in active liver disease. Monitor liver enzymes." },
    },
    quick_tips: [
      "Report any unexplained muscle pain, tenderness, or weakness immediately",
      "Get liver function tests done before starting and periodically thereafter",
      "Avoid large amounts of grapefruit juice",
      "Continue even when cholesterol normalises — stopping increases risk",
    ],
    faqs: [
      { q: "Do I need to take this at night?", a: "Atorvastatin has a long half-life (14 hours), so it can be taken at any time. However, evening dosing is marginally more effective." },
      { q: "Can I stop when my cholesterol is normal?", a: "No. Statins need to be continued long-term. Cholesterol levels will rise again if you stop." },
    ],
    references: ["CARDS Trial 2004", "TNT Trial 2005", "Indian Lipid Guidelines 2016"],
  },
  {
    brand_name: "CLOCYN 75",
    composition: "Clopidogrel Bisulfate 75mg",
    generic_name: "Clopidogrel",
    dosage_form: "tablet",
    strength: "75mg",
    schedule: "H",
    therapeutic_class: "Cardiac",
    price: 114,
    mrp: 380,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "CLOCYN 75 contains Clopidogrel, an antiplatelet agent that prevents blood clots by irreversibly blocking the P2Y12 ADP receptor on platelets. It is essential for preventing heart attacks and strokes in patients with cardiovascular disease.",
    indications: "Prevention of atherothrombotic events in patients with recent MI, recent stroke, or established peripheral arterial disease. Acute coronary syndrome (with aspirin).",
    contraindications: "Active pathological bleeding (peptic ulcer, intracranial haemorrhage), severe hepatic impairment.",
    side_effects: "Common: bleeding, bruising, diarrhoea, abdominal pain. Uncommon: headache, rash. Rare: TTP, severe bleeding, pancytopenia.",
    drug_interactions: "PPIs (omeprazole reduces efficacy — use pantoprazole instead), NSAIDs (bleeding risk), warfarin, SSRIs.",
    dosage_instructions: "Take once daily, with or without food. Do not stop without medical advice, especially if a coronary stent is in place.",
    storage_instructions: "Store below 30°C. No special requirements.",
    habit_forming: false,
    is_chronic: true,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["heart", "antiplatelet", "clopidogrel", "blood thinner", "cardiac", "stroke prevention"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Thienopyridine (Antiplatelet)",
    action_class: "Irreversible P2Y12 ADP receptor antagonist — inhibits platelet aggregation for the lifetime of the platelet (7-10 days)",
    safety_advice: {
      pregnancy: { rating: "caution", note: "No adequate human data. Use only if clearly needed." },
      breastfeeding: { rating: "caution", note: "Unknown if excreted in milk. Weigh risks vs benefits." },
      alcohol: { rating: "caution", note: "Alcohol may increase GI bleeding risk." },
      driving: { rating: "safe", note: "No known effect on driving." },
      kidney: { rating: "safe", note: "No dose adjustment required." },
      liver: { rating: "caution", note: "Requires hepatic activation (CYP2C19). Avoid in severe liver disease." },
    },
    quick_tips: [
      "Do NOT stop this medicine without consulting your doctor — especially with stents",
      "Inform all doctors/dentists that you are on clopidogrel before any procedure",
      "Use pantoprazole (not omeprazole) if you need an acid reducer",
      "Report any unusual bleeding or bruising",
    ],
    faqs: [
      { q: "How long do I need to take this?", a: "Duration depends on your condition. After a heart stent, usually 6-12 months minimum. Your cardiologist will advise." },
      { q: "Can I take aspirin with this?", a: "Yes, dual antiplatelet therapy (DAPT) with aspirin is standard after acute coronary syndrome or stent placement." },
    ],
    references: ["CAPRIE Trial 1996", "CURE Trial 2001", "CDSCO Approved Prescribing Information"],
  },
  {
    brand_name: "ATORCYN-CV Tab",
    composition: "Atorvastatin 10mg + Clopidogrel 75mg",
    generic_name: "Atorvastatin + Clopidogrel",
    dosage_form: "capsule",
    strength: "10mg/75mg",
    schedule: "H",
    therapeutic_class: "Cardiac",
    price: 204,
    mrp: 680,
    pack_size: "10 capsules",
    unit_type: "strip",
    description:
      "ATORCYN-CV combines atorvastatin (cholesterol-lowering) with clopidogrel (antiplatelet) in a single capsule. This combination is frequently prescribed for patients who have had a heart attack or stent placement to reduce cholesterol and prevent further clotting events.",
    indications: "Secondary prevention in patients with acute coronary syndrome, post-PCI with stent, or established atherosclerotic cardiovascular disease requiring both lipid-lowering and antiplatelet therapy.",
    contraindications: "Active bleeding, active liver disease, pregnancy, breastfeeding.",
    side_effects: "Common: bleeding, bruising, headache, myalgia, GI upset. Uncommon: elevated liver enzymes. Rare: rhabdomyolysis, TTP.",
    drug_interactions: "Omeprazole (reduces clopidogrel efficacy), warfarin, fibrates, cyclosporine, NSAIDs.",
    dosage_instructions: "Take once daily in the evening. Swallow whole. Continue as directed even if feeling well.",
    storage_instructions: "Store below 30°C. Protect from moisture.",
    habit_forming: false,
    is_chronic: true,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["heart", "cholesterol", "antiplatelet", "cardiac", "statin", "combination"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Statin + Thienopyridine",
    action_class: "HMG-CoA reductase inhibition + irreversible P2Y12 ADP receptor blockade",
    safety_advice: {
      pregnancy: { rating: "unsafe", note: "Both components are contraindicated in pregnancy." },
      breastfeeding: { rating: "unsafe", note: "Atorvastatin is contraindicated during breastfeeding." },
      alcohol: { rating: "caution", note: "Increases liver toxicity and bleeding risk." },
      driving: { rating: "safe", note: "No significant effect on driving." },
      kidney: { rating: "safe", note: "No dose adjustment required." },
      liver: { rating: "caution", note: "Contraindicated in active liver disease." },
    },
    quick_tips: [
      "Single capsule replaces two separate tablets — better compliance",
      "Do not stop without cardiologist approval",
      "Report muscle pain and unusual bleeding immediately",
    ],
    faqs: [
      { q: "Why do I need both medicines?", a: "After a heart event, you need both: clopidogrel prevents new clots while atorvastatin stabilises existing cholesterol plaques and prevents new buildup." },
    ],
    references: ["PROVE IT-TIMI 22 Trial", "CDSCO Approved Prescribing Information"],
  },

  // ═══════════════════════════════════════════
  //  VITAMINS & WELLNESS (4 products)
  // ═══════════════════════════════════════════
  {
    brand_name: "MECYN 1500",
    composition: "Methylcobalamin 1500mcg",
    generic_name: "Methylcobalamin",
    dosage_form: "tablet",
    strength: "1500mcg",
    schedule: "OTC",
    therapeutic_class: "Vitamins & Wellness",
    price: 88,
    mrp: 250,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "MECYN 1500 contains Methylcobalamin, the active, bioavailable form of Vitamin B12. Unlike cyanocobalamin, methylcobalamin does not require hepatic conversion and is directly utilised for nerve repair, red blood cell formation, and DNA synthesis.",
    indications: "Vitamin B12 deficiency, peripheral neuropathy, diabetic neuropathy, megaloblastic anaemia, nerve damage from various causes.",
    contraindications: "Hypersensitivity to cobalamin or any excipient.",
    side_effects: "Generally well-tolerated. Rare: nausea, diarrhoea, headache, itching, allergic reactions.",
    drug_interactions: "Metformin (reduces B12 absorption — supplementation recommended), colchicine, aminosalicylic acid, chloramphenicol.",
    dosage_instructions: "Take once daily after food. For neuropathy, higher doses may be prescribed initially. Best absorbed when taken with a meal.",
    storage_instructions: "Store below 25°C. Protect from light and moisture.",
    habit_forming: false,
    is_chronic: false,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["vitamin B12", "methylcobalamin", "neuropathy", "nerve health", "supplement", "vitamins"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Cobalamin (Vitamin B12 analogue)",
    action_class: "Cofactor for methionine synthase and methylmalonyl-CoA mutase — essential for myelin synthesis and nerve function",
    safety_advice: {
      pregnancy: { rating: "safe", note: "B12 supplementation is safe and recommended in pregnancy." },
      breastfeeding: { rating: "safe", note: "Safe during breastfeeding. B12 passes into breast milk, which is beneficial." },
      alcohol: { rating: "safe", note: "No known interaction with alcohol." },
      driving: { rating: "safe", note: "No effect on driving ability." },
      kidney: { rating: "safe", note: "Safe in renal impairment. Water-soluble, excess is excreted." },
      liver: { rating: "safe", note: "No hepatic concerns." },
    },
    quick_tips: [
      "Ideal supplement for patients on long-term metformin therapy",
      "Vegetarians and vegans are at higher risk of B12 deficiency",
      "Tingling, numbness in hands/feet may indicate B12 deficiency",
    ],
    faqs: [
      { q: "What is the difference between methylcobalamin and cyanocobalamin?", a: "Methylcobalamin is the bioactive form that the body can use directly. Cyanocobalamin needs to be converted in the liver first." },
      { q: "Can I take this daily long-term?", a: "Yes, B12 is water-soluble. Excess is safely excreted. Long-term supplementation is common and safe." },
    ],
    references: ["Indian Pharmacopoeia 2021", "WHO Essential Medicines List"],
  },
  {
    brand_name: "D3CYN 60K",
    composition: "Cholecalciferol (Vitamin D3) 60,000 IU",
    generic_name: "Cholecalciferol",
    dosage_form: "capsule",
    strength: "60000 IU",
    schedule: "OTC",
    therapeutic_class: "Vitamins & Wellness",
    price: 54,
    mrp: 180,
    pack_size: "4 capsules",
    unit_type: "strip",
    description:
      "D3CYN 60K is a high-dose Vitamin D3 supplement taken once weekly. Vitamin D is essential for calcium absorption, bone health, immune function, and muscle strength. Deficiency is extremely common in India despite abundant sunlight.",
    indications: "Vitamin D deficiency and insufficiency, osteoporosis prevention, rickets, osteomalacia, adjunct in calcium supplementation.",
    contraindications: "Hypercalcaemia, hypervitaminosis D, severe renal impairment.",
    side_effects: "Rare at recommended doses: nausea, vomiting, constipation. Toxicity (overdose): hypercalcaemia, kidney stones.",
    drug_interactions: "Thiazide diuretics (may increase calcium levels), orlistat (reduces absorption), cholestyramine.",
    dosage_instructions: "Take ONE capsule per WEEK for 8 weeks (loading dose), then one per month (maintenance). Take with a fatty meal for better absorption.",
    storage_instructions: "Store below 25°C. Protect from light and moisture.",
    habit_forming: false,
    is_chronic: false,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["vitamin D3", "cholecalciferol", "bone health", "calcium", "sunshine vitamin", "vitamins"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Secosteroid (Vitamin D3)",
    action_class: "Pro-hormone — converted to calcitriol in liver and kidney, which regulates calcium and phosphorus homeostasis",
    safety_advice: {
      pregnancy: { rating: "safe", note: "Vitamin D supplementation is recommended in pregnancy. Stick to prescribed dose." },
      breastfeeding: { rating: "safe", note: "Safe and beneficial. Helps both mother and infant bone health." },
      alcohol: { rating: "safe", note: "No known interaction." },
      driving: { rating: "safe", note: "No effect on driving." },
      kidney: { rating: "caution", note: "Avoid in severe renal impairment or kidney stones. Monitor calcium levels." },
      liver: { rating: "safe", note: "Requires hepatic conversion (25-hydroxylation) but safe in liver disease." },
    },
    quick_tips: [
      "Take with a fatty meal (milk, nuts, ghee) for 50% better absorption",
      "This is a WEEKLY dose, not daily — do not take daily",
      "Get a blood test (25-OH Vitamin D) to track your levels",
      "Target level: 30-50 ng/mL for optimal health",
    ],
    faqs: [
      { q: "Can I take this daily instead of weekly?", a: "No. 60,000 IU is a weekly dose. Taking it daily would cause Vitamin D toxicity." },
      { q: "Why am I deficient if I live in a sunny country?", a: "Sunscreen, indoor lifestyles, darker skin tones, and air pollution all reduce Vitamin D synthesis from sunlight." },
    ],
    references: ["Endocrine Society Guidelines 2011", "Indian Academy of Pediatrics Vitamin D Guidelines"],
  },
  {
    brand_name: "CALCYN-D Tab",
    composition: "Calcium Carbonate 1250mg (eq. to 500mg elemental Ca) + Vitamin D3 250 IU",
    generic_name: "Calcium + Vitamin D3",
    dosage_form: "tablet",
    strength: "500mg/250IU",
    schedule: "OTC",
    therapeutic_class: "Vitamins & Wellness",
    price: 112,
    mrp: 320,
    pack_size: "15 tablets",
    unit_type: "strip",
    description:
      "CALCYN-D provides calcium and Vitamin D3 together for optimal bone health. Vitamin D3 enhances calcium absorption from the gut, making this combination more effective than calcium alone for preventing and treating osteoporosis.",
    indications: "Calcium and Vitamin D supplementation, osteoporosis prevention and treatment, pregnancy and lactation support, post-menopausal bone loss.",
    contraindications: "Hypercalcaemia, hypercalciuria, severe renal impairment, kidney stones, sarcoidosis.",
    side_effects: "Common: constipation, bloating, gas. Uncommon: nausea. Rare: hypercalcaemia (with excessive dose).",
    drug_interactions: "Tetracycline antibiotics (take 2 hrs apart), levothyroxine (take 4 hrs apart), bisphosphonates (take 30 min apart), iron supplements (take separately).",
    dosage_instructions: "Take 1 tablet twice daily after meals. Chew or swallow with water. Take at least 2 hours apart from thyroid or antibiotic medications.",
    storage_instructions: "Store below 30°C. Keep in a dry place.",
    habit_forming: false,
    is_chronic: false,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["calcium", "vitamin D", "bone health", "osteoporosis", "supplement", "vitamins"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Mineral + Secosteroid",
    action_class: "Calcium supplementation + Vitamin D3-mediated gut absorption enhancement",
    safety_advice: {
      pregnancy: { rating: "safe", note: "Recommended during pregnancy for maternal and foetal bone health." },
      breastfeeding: { rating: "safe", note: "Safe and recommended during breastfeeding." },
      alcohol: { rating: "safe", note: "No known interaction." },
      driving: { rating: "safe", note: "No effect." },
      kidney: { rating: "caution", note: "Avoid in kidney stones or severe renal impairment. Monitor calcium levels." },
      liver: { rating: "safe", note: "No hepatic concerns." },
    },
    quick_tips: [
      "Take after meals for better absorption and less stomach upset",
      "Space 2+ hours from thyroid medications and antibiotics",
      "Split the dose (morning + evening) rather than taking both together",
    ],
    faqs: [
      { q: "Can I take this with milk?", a: "Yes, but you don't need to. The tablet already provides sufficient calcium per dose." },
      { q: "How long should I take calcium supplements?", a: "Duration depends on your condition. For osteoporosis prevention, long-term use is common. Consult your doctor." },
    ],
    references: ["IOF Position Statement on Calcium", "Indian Menopause Society Guidelines"],
  },
  {
    brand_name: "IRONCYN XT",
    composition: "Ferrous Ascorbate eq. to 100mg Elemental Iron + Folic Acid 1.5mg",
    generic_name: "Iron + Folic Acid",
    dosage_form: "tablet",
    strength: "100mg/1.5mg",
    schedule: "OTC",
    therapeutic_class: "Vitamins & Wellness",
    price: 70,
    mrp: 200,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "IRONCYN XT provides iron as ferrous ascorbate (better absorbed, less GI irritation than ferrous sulfate) with folic acid. This combination is essential for treating iron-deficiency anaemia, especially common in women, pregnant patients, and growing children.",
    indications: "Iron deficiency anaemia, prophylaxis of iron and folic acid deficiency in pregnancy, post-surgical anaemia recovery.",
    contraindications: "Haemochromatosis, haemosiderosis, thalassaemia, haemolytic anaemia, concurrent IV iron therapy.",
    side_effects: "Common: dark stools (harmless), nausea, constipation, stomach upset. Uncommon: diarrhoea, tooth staining (liquid forms).",
    drug_interactions: "Tetracycline, antacids, calcium supplements (take 2 hrs apart), levothyroxine (take 4 hrs apart), tea/coffee (reduce absorption).",
    dosage_instructions: "Take on empty stomach for best absorption (1 hour before or 2 hours after meals). If stomach upset occurs, take with food. Pair with Vitamin C-rich juice.",
    storage_instructions: "Store below 30°C. Keep away from children (iron overdose is dangerous in children).",
    habit_forming: false,
    is_chronic: false,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["iron", "folic acid", "anaemia", "haemoglobin", "pregnancy", "vitamins"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Iron Salt + B Vitamin",
    action_class: "Iron replenishment + folate supplementation — essential for haemoglobin synthesis and red blood cell production",
    safety_advice: {
      pregnancy: { rating: "safe", note: "Iron and folic acid supplementation is strongly recommended during pregnancy." },
      breastfeeding: { rating: "safe", note: "Safe during breastfeeding." },
      alcohol: { rating: "caution", note: "Chronic alcohol use worsens iron absorption and folate deficiency." },
      driving: { rating: "safe", note: "No effect on driving." },
      kidney: { rating: "safe", note: "Generally safe. Excess iron is not renally excreted." },
      liver: { rating: "caution", note: "Avoid in iron overload conditions. Monitor in liver disease." },
    },
    quick_tips: [
      "Take with orange juice or Vitamin C for 2-3x better iron absorption",
      "Avoid tea, coffee, and milk within 1 hour of taking this medicine",
      "Dark/black stools are normal and harmless — not a cause for concern",
      "Keep out of reach of children — iron overdose is a medical emergency",
    ],
    faqs: [
      { q: "Why are my stools dark?", a: "This is completely normal with iron supplements. Unabsorbed iron turns stools dark. It is harmless." },
      { q: "How long until my haemoglobin improves?", a: "Haemoglobin rises about 1 g/dL per month. Continue for 3-6 months to replenish iron stores." },
    ],
    references: ["WHO Guidelines on Iron Supplementation", "ICMR-NIN RDA 2020"],
  },

  // ═══════════════════════════════════════════
  //  PAIN & FEVER (2 products)
  // ═══════════════════════════════════════════
  {
    brand_name: "PARACYN 500",
    composition: "Paracetamol (Acetaminophen) 500mg",
    generic_name: "Paracetamol",
    dosage_form: "tablet",
    strength: "500mg",
    schedule: "OTC",
    therapeutic_class: "Pain & Fever",
    price: 10,
    mrp: 25,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "PARACYN 500 is a trusted pain reliever and fever reducer. Paracetamol works by inhibiting prostaglandin synthesis in the central nervous system. It is the safest first-line analgesic when used at recommended doses.",
    indications: "Mild to moderate pain (headache, toothache, musculoskeletal pain, menstrual pain), fever reduction, post-vaccination fever.",
    contraindications: "Severe hepatic impairment, known hypersensitivity to paracetamol.",
    side_effects: "Rare at recommended doses. Overdose: severe hepatotoxicity (liver damage). Uncommon: skin rash, blood disorders.",
    drug_interactions: "Warfarin (prolonged use may increase INR), alcohol (hepatotoxicity risk), carbamazepine, phenytoin (increased liver damage risk).",
    dosage_instructions: "Adults: 1-2 tablets every 4-6 hours as needed. Maximum 4000 mg (8 tablets) per day. Do not exceed recommended dose. Take with water.",
    storage_instructions: "Store below 25°C. Keep out of reach of children.",
    habit_forming: false,
    is_chronic: false,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["pain", "fever", "paracetamol", "headache", "body ache", "pain relief"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Para-aminophenol derivative",
    action_class: "Central COX inhibitor / Central analgesic — inhibits prostaglandin synthesis in the CNS to reduce pain and fever",
    safety_advice: {
      pregnancy: { rating: "safe", note: "Paracetamol is the safest painkiller in pregnancy at recommended doses." },
      breastfeeding: { rating: "safe", note: "Compatible with breastfeeding. Small amounts in breast milk are safe." },
      alcohol: { rating: "unsafe", note: "Alcohol significantly increases the risk of liver damage with paracetamol. Avoid." },
      driving: { rating: "safe", note: "No effect on driving ability." },
      kidney: { rating: "safe", note: "Safe at recommended doses. Preferred over NSAIDs in renal impairment." },
      liver: { rating: "caution", note: "Avoid in severe liver disease. Do not exceed 2000 mg/day if hepatic impairment." },
    },
    quick_tips: [
      "NEVER exceed 4000mg (8 tablets) in 24 hours",
      "Check all other medicines for paracetamol content to avoid double-dosing",
      "This is the safest painkiller for pregnant women at recommended doses",
      "Seek emergency help if overdose is suspected — liver damage can be delayed",
    ],
    faqs: [
      { q: "Can I take paracetamol with ibuprofen?", a: "Yes, they can be alternated or taken together as they work by different mechanisms. But do not exceed the dose of either." },
      { q: "How long can I take this continuously?", a: "For self-medication, do not exceed 3 days for fever or 10 days for pain without consulting a doctor." },
    ],
    references: ["WHO Essential Medicines List", "Indian Pharmacopoeia 2021", "NICE Guidelines on Acute Pain"],
  },
  {
    brand_name: "IBUCYN 400",
    composition: "Ibuprofen 400mg",
    generic_name: "Ibuprofen",
    dosage_form: "tablet",
    strength: "400mg",
    schedule: "OTC",
    therapeutic_class: "Pain & Fever",
    price: 16,
    mrp: 45,
    pack_size: "10 tablets",
    unit_type: "strip",
    description:
      "IBUCYN 400 contains Ibuprofen, a non-steroidal anti-inflammatory drug (NSAID). It provides pain relief, reduces inflammation, and lowers fever. It is particularly effective for inflammatory pain conditions like arthritis, sprains, and menstrual cramps.",
    indications: "Mild to moderate pain, inflammation, fever, headache, dental pain, menstrual pain, musculoskeletal disorders, post-operative pain.",
    contraindications: "Active peptic ulcer, GI bleeding, severe renal/hepatic impairment, third trimester pregnancy, aspirin-sensitive asthma, heart failure (NYHA III-IV).",
    side_effects: "Common: stomach pain, nausea, dyspepsia, headache. Uncommon: GI ulceration, dizziness, rash. Rare: GI bleeding, renal impairment, cardiovascular events.",
    drug_interactions: "Aspirin (may reduce cardioprotective effect), warfarin, SSRIs (bleeding risk), methotrexate, lithium, ACE inhibitors.",
    dosage_instructions: "Take with or after food to reduce stomach irritation. 200-400 mg every 6-8 hours as needed. Maximum 1200 mg/day for OTC use.",
    storage_instructions: "Store below 25°C. Protect from moisture.",
    habit_forming: false,
    is_chronic: false,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["pain", "fever", "ibuprofen", "NSAID", "inflammation", "headache", "pain relief"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Propionic acid derivative (NSAID)",
    action_class: "Non-selective COX-1/COX-2 inhibitor — reduces prostaglandin synthesis peripherally, decreasing pain, inflammation, and fever",
    safety_advice: {
      pregnancy: { rating: "unsafe", note: "Contraindicated in third trimester. Avoid throughout pregnancy — use paracetamol instead." },
      breastfeeding: { rating: "safe", note: "Compatible with breastfeeding in short courses. Minimal amounts in breast milk." },
      alcohol: { rating: "unsafe", note: "Significantly increases risk of GI bleeding when combined with alcohol." },
      driving: { rating: "caution", note: "Dizziness may occur in some patients." },
      kidney: { rating: "caution", note: "Can reduce renal blood flow. Avoid in renal impairment or dehydration." },
      liver: { rating: "caution", note: "Use lowest effective dose for shortest duration. Monitor in liver disease." },
    },
    quick_tips: [
      "Always take with food or milk to protect your stomach",
      "Paracetamol is a safer first choice — try it before ibuprofen",
      "Stay well hydrated while taking NSAIDs",
      "Do not use for more than 10 days without medical advice",
    ],
    faqs: [
      { q: "Is ibuprofen stronger than paracetamol?", a: "They work differently. Ibuprofen is better for inflammatory pain (arthritis, sprains) while paracetamol is preferred for general fever and headache." },
      { q: "Can I take this on an empty stomach?", a: "It is not recommended. Take with food, milk, or an antacid to reduce stomach irritation." },
    ],
    references: ["WHO Essential Medicines List", "NICE Guidelines on NSAIDs"],
  },

  // ═══════════════════════════════════════════
  //  ANTIBIOTICS (2 products)
  // ═══════════════════════════════════════════
  {
    brand_name: "AMOXCYN 500",
    composition: "Amoxicillin Trihydrate 500mg",
    generic_name: "Amoxicillin",
    dosage_form: "capsule",
    strength: "500mg",
    schedule: "H",
    therapeutic_class: "Antibiotics",
    price: 98,
    mrp: 280,
    pack_size: "10 capsules",
    unit_type: "strip",
    description:
      "AMOXCYN 500 contains Amoxicillin, a broad-spectrum penicillin antibiotic. It is one of the most commonly prescribed antibiotics worldwide for treating bacterial infections of the respiratory tract, ear, urinary tract, and skin.",
    indications: "Upper and lower respiratory infections, otitis media, urinary tract infections, skin and soft tissue infections, H. pylori eradication (with other drugs), dental infections.",
    contraindications: "Penicillin allergy (cross-reactivity with cephalosporins possible), infectious mononucleosis (risk of rash).",
    side_effects: "Common: diarrhoea, nausea, skin rash. Uncommon: vomiting, candidiasis (oral or vaginal thrush). Rare: anaphylaxis, C. difficile colitis, blood dyscrasias.",
    drug_interactions: "Allopurinol (increased rash risk), methotrexate (reduced clearance), warfarin (monitor INR), oral contraceptives (reduced efficacy).",
    dosage_instructions: "Take every 8 hours (three times daily). Can be taken with or without food. Complete the full course even if feeling better. Drink plenty of water.",
    storage_instructions: "Store below 25°C. Keep capsules dry. Reconstituted suspension: store in fridge, use within 7 days.",
    habit_forming: false,
    is_chronic: false,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["antibiotic", "amoxicillin", "infection", "penicillin", "bacterial infection"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Aminopenicillin (Beta-lactam antibiotic)",
    action_class: "Bactericidal — inhibits bacterial cell wall synthesis by binding to penicillin-binding proteins (PBPs)",
    safety_advice: {
      pregnancy: { rating: "safe", note: "Amoxicillin is one of the safest antibiotics in pregnancy (Category B)." },
      breastfeeding: { rating: "safe", note: "Compatible with breastfeeding. Small amounts in breast milk may cause diarrhoea in infant." },
      alcohol: { rating: "caution", note: "Alcohol does not directly interact but may worsen GI side effects and slow recovery." },
      driving: { rating: "safe", note: "No effect on driving ability." },
      kidney: { rating: "caution", note: "Dose adjustment required in severe renal impairment (eGFR < 30)." },
      liver: { rating: "safe", note: "Generally safe. Rare hepatotoxicity reported with amoxicillin-clavulanate, not amoxicillin alone." },
    },
    quick_tips: [
      "COMPLETE the full course — stopping early breeds resistant bacteria",
      "Take at evenly spaced intervals (every 8 hours) for best effect",
      "Take a probiotic (2 hours apart) to prevent antibiotic-associated diarrhoea",
      "Inform your doctor if you have a penicillin allergy",
    ],
    faqs: [
      { q: "Can I stop when I feel better?", a: "No. Always complete the full prescribed course. Stopping early can lead to antibiotic resistance and infection relapse." },
      { q: "Does amoxicillin affect birth control pills?", a: "Current evidence suggests minimal interaction, but some doctors recommend additional precautions during the antibiotic course." },
    ],
    references: ["WHO Essential Medicines List", "ICMR Antibiotic Treatment Guidelines 2019"],
  },
  {
    brand_name: "AZICYN 500",
    composition: "Azithromycin Dihydrate 500mg",
    generic_name: "Azithromycin",
    dosage_form: "tablet",
    strength: "500mg",
    schedule: "H",
    therapeutic_class: "Antibiotics",
    price: 105,
    mrp: 350,
    pack_size: "3 tablets",
    unit_type: "strip",
    description:
      "AZICYN 500 contains Azithromycin, a macrolide antibiotic known for its convenient 3-day dosing. It concentrates in tissues at much higher levels than in blood, providing prolonged antimicrobial activity even after the last dose.",
    indications: "Community-acquired pneumonia, acute bacterial sinusitis, pharyngitis/tonsillitis, otitis media, skin infections, uncomplicated genital chlamydia, traveller's diarrhoea.",
    contraindications: "Hypersensitivity to macrolides, history of cholestatic jaundice with azithromycin, myasthenia gravis.",
    side_effects: "Common: diarrhoea, nausea, abdominal pain, vomiting. Uncommon: headache, dizziness, abnormal taste. Rare: QT prolongation, hearing loss, liver injury.",
    drug_interactions: "Antacids (take 1 hr before or 2 hrs after), warfarin (monitor INR), ergot alkaloids, QT-prolonging drugs (avoid combination).",
    dosage_instructions: "Take 500 mg once daily for 3 days. Take 1 hour before or 2 hours after meals for best absorption. Can also be taken with food if stomach upset occurs.",
    storage_instructions: "Store below 30°C. No special requirements.",
    habit_forming: false,
    is_chronic: false,
    is_narcotic: false,
    requires_refrigeration: false,
    gst_rate: 12,
    tags: ["antibiotic", "azithromycin", "infection", "macrolide", "pneumonia"],
    manufacturer: "Supracyn Pharmaceuticals",
    chemical_class: "Azalide (Macrolide antibiotic)",
    action_class: "Bacteriostatic — binds to 50S ribosomal subunit, inhibiting bacterial protein synthesis",
    safety_advice: {
      pregnancy: { rating: "caution", note: "Use only if benefit outweighs risk. Animal studies show no harm but human data is limited." },
      breastfeeding: { rating: "caution", note: "Excreted in breast milk. Short course likely safe. Monitor infant for diarrhoea." },
      alcohol: { rating: "caution", note: "May worsen liver side effects and GI symptoms. Best avoided during treatment." },
      driving: { rating: "caution", note: "Dizziness may occur in some patients." },
      kidney: { rating: "safe", note: "No dose adjustment required for renal impairment." },
      liver: { rating: "caution", note: "Rare hepatotoxicity reported. Avoid if history of azithromycin-related jaundice." },
    },
    quick_tips: [
      "Only 3 tablets needed — but the drug keeps working in your body for 5+ more days",
      "Take on an empty stomach for best absorption (1 hr before or 2 hrs after food)",
      "Do not take with antacids",
      "Do not self-prescribe antibiotics — antibiotic resistance is a global crisis",
    ],
    faqs: [
      { q: "Why only 3 tablets?", a: "Azithromycin has a uniquely long half-life (68 hours) and concentrates in tissues. Three doses provide therapeutic levels for 7-10 days." },
      { q: "Can I take this with dairy?", a: "Yes, dairy does not significantly affect azithromycin absorption unlike some other antibiotics." },
    ],
    references: ["ICMR Antibiotic Treatment Guidelines 2019", "WHO AWaRe Classification 2023"],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function makeSku(brandName: string): string {
  return `SUPRA-${brandName.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 48)
}

// ── Main migration function ─────────────────────────────────────────────────

export default async function migration_008_generic_medicines({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // ── Pre-requisites ──
  const salesChannelService = container.resolve(ModuleRegistrationName.SALES_CHANNEL) as any
  const [defaultSalesChannel] = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel?.id) {
    logger.warn("[seed-008] Default Sales Channel not found. Run base seed first. Skipping.")
    return
  }

  const fulfillmentService = container.resolve(ModuleRegistrationName.FULFILLMENT) as any
  const [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" })
  if (!shippingProfile?.id) {
    logger.warn("[seed-008] No default shipping profile. Skipping.")
    return
  }

  // ── Delete existing (idempotent) ──
  const handles = PRODUCTS.map((p) => slugify(p.brand_name))
  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: handles },
  })
  if (existing?.length) {
    logger.info(`[seed-008] Deleting ${existing.length} existing generic-medicines products...`)
    await deleteProductsWorkflow(container).run({
      input: { ids: (existing as any[]).map((p) => p.id) },
    })
  }

  // ── Collections ──
  const collectionTitles: Record<string, string> = {
    Antidiabetic: "Antidiabetic",
    Antihypertensive: "Antihypertensive",
    Cardiac: "Cardiac",
    "Vitamins & Wellness": "Vitamins & Wellness",
    "Pain & Fever": "Pain & Fever",
    Antibiotics: "Antibiotics",
  }

  const wantedCollections = Array.from(new Set(PRODUCTS.map((p) => collectionTitles[p.therapeutic_class] ?? "General")))
  const { data: existingCollections } = await query.graph({
    entity: "product_collection",
    fields: ["id", "title", "handle"],
    filters: { title: wantedCollections },
  })

  const missingTitles = wantedCollections.filter(
    (t) => !(existingCollections as any[])?.some((c) => c.title === t)
  )

  const createdCollections =
    missingTitles.length > 0
      ? (
          await createCollectionsWorkflow(container).run({
            input: {
              collections: missingTitles.map((title) => ({
                title,
                handle: slugify(title),
                metadata: { source: "generic-medicines-seed-008" },
              })),
            },
          })
        ).result
      : []

  const allCollections = [...(existingCollections as any[]), ...(createdCollections as any[])]
  const collectionIdByTitle = new Map<string, string>(
    allCollections.map((c) => [c.title, c.id])
  )

  // ── Create products ──
  const { result: created } = await createProductsWorkflow(container).run({
    input: {
      products: PRODUCTS.map((p) => {
        const handle = slugify(p.brand_name)
        const collectionTitle = collectionTitles[p.therapeutic_class] ?? "General"
        return {
          title: p.brand_name,
          handle,
          description: p.description,
          subtitle: p.composition,
          status: "published",
          sales_channels: [{ id: defaultSalesChannel.id }],
          collection_id: collectionIdByTitle.get(collectionTitle),
          options: [{ title: "Pack", values: ["default"] }],
          variants: [
            {
              title: p.brand_name,
              sku: makeSku(p.brand_name),
              options: { Pack: "default" },
              prices: [{ currency_code: "inr", amount: p.price }],
              manage_inventory: true,
              allow_backorder: false,
            },
          ],
          shipping_profile_id: shippingProfile.id,
          metadata: {
            source: "generic-medicines-seed-008",
            pharma: true,
            manufacturer: p.manufacturer,
          },
        }
      }),
    },
  })

  // ── Drug product metadata ──
  const pharmaService = container.resolve(PHARMA_MODULE) as any

  await pharmaService.createDrugProducts(
    created.map((product) => {
      const match = PRODUCTS.find((p) => p.brand_name === product.title)
      if (!match) {
        throw new Error(`[seed-008] Missing metadata for "${product.title}"`)
      }
      return {
        product_id: product.id,
        schedule: match.schedule,
        generic_name: match.generic_name,
        therapeutic_class: match.therapeutic_class,
        dosage_form: match.dosage_form,
        strength: match.strength,
        composition: match.composition,
        pack_size: match.pack_size,
        unit_type: match.unit_type,
        mrp_paise: match.mrp * 100, // INR → paise
        gst_rate: match.gst_rate,
        indications: match.indications,
        contraindications: match.contraindications,
        side_effects: match.side_effects,
        drug_interactions: match.drug_interactions,
        dosage_instructions: match.dosage_instructions,
        storage_instructions: match.storage_instructions,
        habit_forming: match.habit_forming,
        is_chronic: match.is_chronic,
        is_narcotic: match.is_narcotic,
        requires_refrigeration: match.requires_refrigeration,
        metadata: {
          source: "generic-medicines-seed-008",
          manufacturer: match.manufacturer,
          chemical_class: match.chemical_class,
          action_class: match.action_class,
          safety_advice: match.safety_advice,
          quick_tips: match.quick_tips,
          faqs: match.faqs,
          references: match.references,
        },
      }
    })
  )

  // ── Inventory ──
  const DEFAULT_STOCK = 100
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  })
  const stockLocation = (stockLocations as any[])?.[0]

  if (stockLocation?.id) {
    const productIds = created.map((p) => p.id).filter(Boolean)
    const { data: variants } = await query.graph({
      entity: "variant",
      fields: ["id", "sku", "product_id"],
      filters: { product_id: productIds },
    })

    const skus = (variants as any[]).filter((v) => v?.sku).map((v) => v.sku)
    const { data: existingInvItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "sku"],
      filters: { sku: skus },
    })
    const invBySku = new Map<string, any>(
      (existingInvItems as any[]).filter((i) => i?.sku).map((i) => [i.sku, i])
    )

    const missingSkus = skus.filter((s) => !invBySku.has(s))
    if (missingSkus.length) {
      const { result: createdInvItems } = await createInventoryItemsWorkflow(container).run({
        input: { items: missingSkus.map((sku) => ({ sku })) as any },
      })
      for (const item of createdInvItems as any[]) {
        if (item?.sku) invBySku.set(item.sku, item)
      }
    }

    const invItemIds = skus.map((s) => invBySku.get(s)?.id).filter(Boolean)
    const { data: existingLevels } = await query.graph({
      entity: "inventory_levels",
      fields: ["id", "inventory_item_id", "location_id"],
      filters: { inventory_item_id: invItemIds, location_id: [stockLocation.id] },
    })
    const levelMap = new Map<string, string>(
      (existingLevels as any[]).map((l: any) => [`${l.inventory_item_id}:${l.location_id}`, l.id])
    )

    const creates: any[] = []
    const updates: any[] = []
    for (const id of invItemIds) {
      const key = `${id}:${stockLocation.id}`
      const existingLevel = levelMap.get(key)
      if (existingLevel) {
        updates.push({ id: existingLevel, inventory_item_id: id, location_id: stockLocation.id, stocked_quantity: DEFAULT_STOCK })
      } else {
        creates.push({ inventory_item_id: id, location_id: stockLocation.id, stocked_quantity: DEFAULT_STOCK })
      }
    }

    if (creates.length || updates.length) {
      await batchInventoryItemLevelsWorkflow(container).run({
        input: { creates, updates, deletes: [] } as any,
      })
    }

    // Link variants to inventory items
    const link = container.resolve(ContainerRegistrationKeys.LINK) as any
    const linkDefs = (variants as any[])
      .filter((v) => v?.sku && invBySku.get(v.sku)?.id)
      .map((v) => ({
        [Modules.PRODUCT]: { variant_id: v.id },
        [Modules.INVENTORY]: { inventory_item_id: invBySku.get(v.sku).id },
      }))

    if (linkDefs.length) {
      await link.create(linkDefs as any)
    }

    logger.info(`[seed-008] Inventory: ${invItemIds.length} variants × ${DEFAULT_STOCK} stock each.`)
  } else {
    logger.warn("[seed-008] No stock location found — skipping inventory.")
  }

  logger.info(`[seed-008] Seeded ${created.length} generic medicines across ${wantedCollections.length} categories.`)
}
