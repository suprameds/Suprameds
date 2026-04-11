import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createCustomersWorkflow,
  createCustomerAddressesWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * POST /admin/customers/import
 *
 * Bulk import customers from pre-parsed CSV rows.
 *
 * Body: { rows: CustomerRow[] }
 *
 * CSV columns (matching customer-import-template.csv):
 *   Email*, First Name*, Last Name*, Phone, Has Account,
 *   Address First Name, Address Last Name, Address Company,
 *   Address 1, Address 2, Address City, Address Province,
 *   Address Country Code, Address Postal Code, Address Phone,
 *   Address Metadata
 */

interface CustomerRow {
  email: string
  first_name: string
  last_name: string
  phone?: string
  has_account?: string
  address_first_name?: string
  address_last_name?: string
  address_company?: string
  address_1?: string
  address_2?: string
  address_city?: string
  address_province?: string
  address_country_code?: string
  address_postal_code?: string
  address_phone?: string
  address_metadata?: string
}

function normalizeRow(raw: Record<string, string>): CustomerRow {
  return {
    email: (raw["Email"] || raw["email"] || "").trim().toLowerCase(),
    first_name: (raw["First Name"] || raw["first_name"] || "").trim(),
    last_name: (raw["Last Name"] || raw["last_name"] || "").trim(),
    phone: (raw["Phone"] || raw["phone"] || "").trim() || undefined,
    has_account: (raw["Has Account"] || raw["has_account"] || "").trim(),
    address_first_name: (raw["Address First Name"] || raw["address_first_name"] || "").trim() || undefined,
    address_last_name: (raw["Address Last Name"] || raw["address_last_name"] || "").trim() || undefined,
    address_company: (raw["Address Company"] || raw["address_company"] || "").trim() || undefined,
    address_1: (raw["Address 1"] || raw["address_1"] || "").trim() || undefined,
    address_2: (raw["Address 2"] || raw["address_2"] || "").trim() || undefined,
    address_city: (raw["Address City"] || raw["address_city"] || "").trim() || undefined,
    address_province: (raw["Address Province"] || raw["address_province"] || "").trim() || undefined,
    address_country_code: (raw["Address Country Code"] || raw["address_country_code"] || "").trim() || undefined,
    address_postal_code: (raw["Address Postal Code"] || raw["address_postal_code"] || "").trim() || undefined,
    address_phone: (raw["Address Phone"] || raw["address_phone"] || "").trim() || undefined,
    address_metadata: (raw["Address Metadata"] || raw["address_metadata"] || "").trim() || undefined,
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { rows: rawRows } = req.body as { rows: Record<string, string>[] }

  if (!rawRows?.length) {
    return res.status(400).json({ error: "No rows provided" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const results: { email: string; status: string; message?: string }[] = []
  let created = 0
  let skipped = 0
  let errors = 0

  // Only check duplicates for the emails being imported (not all customers)
  const importEmails = rawRows
    .map((r) => (r["Email"] || r["email"] || "").trim().toLowerCase())
    .filter(Boolean)
  const { data: existingCustomers } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: { email: importEmails },
  })
  const existingEmails = new Set(
    (existingCustomers as any[]).map((c: any) => c.email?.toLowerCase())
  )

  for (const rawRow of rawRows) {
    const row = normalizeRow(rawRow)

    // Validate required fields
    if (!row.email || !row.first_name || !row.last_name) {
      errors++
      results.push({
        email: row.email || "(empty)",
        status: "error",
        message: "Missing required fields: email, first_name, or last_name",
      })
      continue
    }

    // Email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors++
      results.push({ email: row.email, status: "error", message: "Invalid email format" })
      continue
    }

    // Duplicate check
    if (existingEmails.has(row.email)) {
      skipped++
      results.push({ email: row.email, status: "skipped", message: "Customer already exists" })
      continue
    }

    try {
      // Create customer
      const { result: customers } = await createCustomersWorkflow(req.scope).run({
        input: {
          customersData: [
            {
              email: row.email,
              first_name: row.first_name,
              last_name: row.last_name,
              phone: row.phone,
              has_account: row.has_account === "true" || row.has_account === "1",
            },
          ],
        },
      })

      const customer = customers[0]

      // Create address if provided
      if (row.address_1 && row.address_country_code && customer?.id) {
        try {
          await createCustomerAddressesWorkflow(req.scope).run({
            input: {
              addresses: [
                {
                  customer_id: customer.id,
                  first_name: row.address_first_name || row.first_name,
                  last_name: row.address_last_name || row.last_name,
                  company: row.address_company,
                  address_1: row.address_1,
                  address_2: row.address_2,
                  city: row.address_city,
                  province: row.address_province,
                  country_code: row.address_country_code,
                  postal_code: row.address_postal_code,
                  phone: row.address_phone || row.phone,
                },
              ],
            },
          })
        } catch (addrErr: any) {
          // Customer created but address failed — still count as created
          results.push({
            email: row.email,
            status: "created",
            message: `Customer created but address failed: ${addrErr?.message || "unknown error"}`,
          })
          created++
          existingEmails.add(row.email)
          continue
        }
      }

      created++
      existingEmails.add(row.email)
      results.push({ email: row.email, status: "created" })
    } catch (err: any) {
      errors++
      results.push({
        email: row.email,
        status: "error",
        message: err?.message || "Unknown error",
      })
    }
  }

  return res.json({
    summary: { total: rawRows.length, created, skipped, errors },
    results,
  })
}
