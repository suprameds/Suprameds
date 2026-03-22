/**
 * Drug Interaction Checker — rule-based system using generic name / composition matching.
 *
 * Contains a curated list of 20+ clinically significant drug interactions
 * commonly relevant to an Indian pharmacy (OTC + Rx). Each interaction pair
 * is keyed by normalised generic names and carries severity + description.
 *
 * Because we don't have an external drug-interaction database, matching is
 * done via case-insensitive substring search over the composition string.
 */

export type InteractionSeverity = "major" | "moderate" | "minor"

export interface InteractionWarning {
  drug_a: string
  drug_b: string
  severity: InteractionSeverity
  description: string
}

interface InteractionRule {
  drug_a: string
  drug_b: string
  severity: InteractionSeverity
  description: string
}

/**
 * Curated list of clinically significant drug interaction pairs.
 * Each rule is bidirectional — (A, B) and (B, A) are both checked.
 */
const INTERACTION_RULES: InteractionRule[] = [
  // --- Major ---
  {
    drug_a: "warfarin",
    drug_b: "aspirin",
    severity: "major",
    description:
      "Concurrent use significantly increases bleeding risk. Avoid unless specifically directed by a physician.",
  },
  {
    drug_a: "methotrexate",
    drug_b: "ibuprofen",
    severity: "major",
    description:
      "NSAIDs reduce renal clearance of methotrexate, leading to toxic accumulation. Potentially life-threatening.",
  },
  {
    drug_a: "warfarin",
    drug_b: "ibuprofen",
    severity: "major",
    description:
      "NSAIDs potentiate warfarin's anticoagulant effect and increase GI bleeding risk.",
  },
  {
    drug_a: "clopidogrel",
    drug_b: "omeprazole",
    severity: "major",
    description:
      "Omeprazole inhibits CYP2C19-mediated activation of clopidogrel, reducing its anti-platelet efficacy.",
  },
  {
    drug_a: "ciprofloxacin",
    drug_b: "theophylline",
    severity: "major",
    description:
      "Ciprofloxacin inhibits theophylline metabolism, risking theophylline toxicity (seizures, arrhythmias).",
  },
  {
    drug_a: "metformin",
    drug_b: "contrast dye",
    severity: "major",
    description:
      "Iodinated contrast agents with metformin increase risk of lactic acidosis. Metformin should be withheld.",
  },
  {
    drug_a: "simvastatin",
    drug_b: "erythromycin",
    severity: "major",
    description:
      "Erythromycin inhibits CYP3A4, dramatically increasing statin levels and rhabdomyolysis risk.",
  },
  {
    drug_a: "sildenafil",
    drug_b: "nitroglycerin",
    severity: "major",
    description:
      "Combined use causes severe, potentially fatal hypotension. Absolutely contraindicated.",
  },
  {
    drug_a: "lithium",
    drug_b: "diclofenac",
    severity: "major",
    description:
      "NSAIDs reduce lithium renal clearance, risking lithium toxicity.",
  },

  // --- Moderate ---
  {
    drug_a: "metformin",
    drug_b: "alcohol",
    severity: "moderate",
    description:
      "Alcohol potentiates the lactic-acidosis risk of metformin and may cause severe hypoglycaemia.",
  },
  {
    drug_a: "enalapril",
    drug_b: "potassium",
    severity: "moderate",
    description:
      "ACE inhibitors raise serum potassium; additional potassium supplements may cause hyperkalemia.",
  },
  {
    drug_a: "ramipril",
    drug_b: "potassium",
    severity: "moderate",
    description:
      "ACE inhibitors raise serum potassium; additional potassium supplements may cause hyperkalemia.",
  },
  {
    drug_a: "atorvastatin",
    drug_b: "grapefruit",
    severity: "moderate",
    description:
      "Grapefruit inhibits CYP3A4, increasing statin plasma levels and myopathy risk.",
  },
  {
    drug_a: "amlodipine",
    drug_b: "simvastatin",
    severity: "moderate",
    description:
      "Amlodipine increases simvastatin exposure via CYP3A4 inhibition. Simvastatin dose should not exceed 20mg.",
  },
  {
    drug_a: "ciprofloxacin",
    drug_b: "antacid",
    severity: "moderate",
    description:
      "Aluminium/magnesium antacids chelate ciprofloxacin, reducing its absorption and efficacy.",
  },
  {
    drug_a: "amoxicillin",
    drug_b: "methotrexate",
    severity: "moderate",
    description:
      "Penicillins may reduce renal clearance of methotrexate, increasing toxicity risk.",
  },
  {
    drug_a: "fluoxetine",
    drug_b: "tramadol",
    severity: "moderate",
    description:
      "Combined serotonergic activity raises risk of serotonin syndrome (agitation, tremor, hyperthermia).",
  },
  {
    drug_a: "losartan",
    drug_b: "potassium",
    severity: "moderate",
    description:
      "ARBs reduce aldosterone secretion; added potassium increases hyperkalemia risk.",
  },
  {
    drug_a: "digoxin",
    drug_b: "amiodarone",
    severity: "moderate",
    description:
      "Amiodarone raises digoxin levels by ~70%. Digoxin dose reduction needed.",
  },
  {
    drug_a: "phenytoin",
    drug_b: "fluconazole",
    severity: "moderate",
    description:
      "Fluconazole inhibits CYP2C9, increasing phenytoin levels and risk of toxicity.",
  },

  // --- Minor ---
  {
    drug_a: "paracetamol",
    drug_b: "caffeine",
    severity: "minor",
    description:
      "Caffeine may slightly enhance paracetamol absorption. Generally safe but monitor for increased side effects.",
  },
  {
    drug_a: "cetirizine",
    drug_b: "alcohol",
    severity: "minor",
    description:
      "Alcohol may enhance the sedative effect of cetirizine. Caution when driving or operating machinery.",
  },
  {
    drug_a: "azithromycin",
    drug_b: "antacid",
    severity: "minor",
    description:
      "Antacids reduce azithromycin peak levels. Take azithromycin 1 hour before or 2 hours after antacids.",
  },
  {
    drug_a: "iron",
    drug_b: "calcium",
    severity: "minor",
    description:
      "Calcium reduces iron absorption. Separate doses by at least 2 hours for optimal absorption.",
  },
]

/**
 * Normalise a composition/generic_name string for matching.
 * Strips whitespace, lowercases, and removes common salt suffixes.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s*(hydrochloride|hcl|sodium|potassium|maleate|besylate|mesylate|succinate|fumarate)\s*/g, " ")
    .trim()
}

/**
 * Returns true if `composition` contains `drugName` (normalised substring match).
 */
function compositionContains(composition: string, drugName: string): boolean {
  return normalise(composition).includes(normalise(drugName))
}

/**
 * Check a single pair of compositions for a known interaction.
 */
export function checkSingleInteraction(
  compositionA: string,
  compositionB: string
): InteractionWarning | null {
  for (const rule of INTERACTION_RULES) {
    const aMatchesDrugA = compositionContains(compositionA, rule.drug_a)
    const aMatchesDrugB = compositionContains(compositionA, rule.drug_b)
    const bMatchesDrugA = compositionContains(compositionB, rule.drug_a)
    const bMatchesDrugB = compositionContains(compositionB, rule.drug_b)

    // Bidirectional check: A contains drug_a & B contains drug_b, or vice-versa
    if ((aMatchesDrugA && bMatchesDrugB) || (aMatchesDrugB && bMatchesDrugA)) {
      return {
        drug_a: rule.drug_a,
        drug_b: rule.drug_b,
        severity: rule.severity,
        description: rule.description,
      }
    }
  }
  return null
}

/**
 * Check all pairwise interactions among a list of compositions (e.g. all items in a cart).
 * Returns deduplicated warnings sorted by severity (major → moderate → minor).
 */
export function checkInteractions(compositions: string[]): InteractionWarning[] {
  const warnings: InteractionWarning[] = []
  const seen = new Set<string>()

  for (let i = 0; i < compositions.length; i++) {
    for (let j = i + 1; j < compositions.length; j++) {
      const warning = checkSingleInteraction(compositions[i], compositions[j])
      if (!warning) continue

      // Deduplicate by sorted drug pair key
      const key = [warning.drug_a, warning.drug_b].sort().join("|")
      if (seen.has(key)) continue
      seen.add(key)

      warnings.push(warning)
    }
  }

  const severityOrder: Record<InteractionSeverity, number> = {
    major: 0,
    moderate: 1,
    minor: 2,
  }

  return warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
}
