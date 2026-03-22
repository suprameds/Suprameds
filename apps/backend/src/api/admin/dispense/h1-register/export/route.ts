import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { decryptPhiArray, H1_REGISTER_PHI_FIELDS, isPhiEncryptionEnabled } from "../../../../../lib/phi-crypto"

const CSV_HEADERS = [
  "Entry Date",
  "Patient Name",
  "Patient Address",
  "Patient Age",
  "Prescriber Name",
  "Prescriber Reg No",
  "Drug Name",
  "Brand Name",
  "Batch Number",
  "Quantity",
  "Pharmacist",
  "Pharmacist Reg No",
  "Order Item ID",
  "Dispense Decision ID",
].join(",")

/**
 * Escape a value for CSV output.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function csvEscape(value: unknown): string {
  const str = String(value ?? "")
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function entriesToCsv(entries: any[]): string {
  const rows = entries.map((e) =>
    [
      new Date(e.entry_date).toISOString().slice(0, 10),
      e.patient_name,
      e.patient_address,
      e.patient_age,
      e.prescriber_name,
      e.prescriber_reg_no,
      e.drug_name,
      e.brand_name,
      e.batch_number,
      e.quantity_dispensed,
      e.dispensing_pharmacist,
      e.pharmacist_reg_no,
      e.order_item_id,
      e.dispense_decision_id,
    ]
      .map(csvEscape)
      .join(",")
  )

  return [CSV_HEADERS, ...rows].join("\n")
}

async function fetchEntries(
  container: any,
  from: string,
  to: string
): Promise<any[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "h1_register_entry",
    fields: [
      "id",
      "entry_date",
      "patient_name",
      "patient_address",
      "patient_age",
      "prescriber_name",
      "prescriber_reg_no",
      "drug_name",
      "brand_name",
      "batch_number",
      "quantity_dispensed",
      "dispensing_pharmacist",
      "pharmacist_reg_no",
      "order_item_id",
      "dispense_decision_id",
      "created_at",
    ],
    filters: {
      created_at: {
        $gte: new Date(from).toISOString(),
        $lte: new Date(to).toISOString(),
      },
    },
  })

  return data as any[]
}

function sendCsvResponse(
  res: MedusaResponse,
  csv: string,
  from: string,
  to: string
) {
  res.setHeader("Content-Type", "text/csv")
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=h1-register-${from}-to-${to}.csv`
  )
  res.send(csv)
}

/**
 * GET /admin/dispense/h1-register/export
 * Query params: from (ISO date), to (ISO date), format (csv | json, default csv)
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { from, to, format = "csv" } = req.query as {
    from: string
    to: string
    format?: string
  }

  if (!from || !to) {
    res.status(400).json({ message: "Both 'from' and 'to' query params are required" })
    return
  }

  let entries = await fetchEntries(req.scope, from, to)

  // Decrypt PHI before export
  if (isPhiEncryptionEnabled()) {
    entries = decryptPhiArray(entries, H1_REGISTER_PHI_FIELDS)
  }

  if (format === "json") {
    res.json({ entries, count: entries.length })
    return
  }

  const csv = entriesToCsv(entries)
  sendCsvResponse(res, csv, from, to)
}

/**
 * POST /admin/dispense/h1-register/export
 * Body params: from (ISO date), to (ISO date), format (csv | json, default csv)
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { from, to, format = "csv" } = req.body as {
    from: string
    to: string
    format?: string
  }

  if (!from || !to) {
    res.status(400).json({ message: "Both 'from' and 'to' body params are required" })
    return
  }

  let entries = await fetchEntries(req.scope, from, to)

  if (isPhiEncryptionEnabled()) {
    entries = decryptPhiArray(entries, H1_REGISTER_PHI_FIELDS)
  }

  if (format === "json") {
    res.json({ entries, count: entries.length })
    return
  }

  const csv = entriesToCsv(entries)
  sendCsvResponse(res, csv, from, to)
}
