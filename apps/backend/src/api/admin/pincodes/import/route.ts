import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { generateEntityId } from "@medusajs/framework/utils"

/**
 * POST /admin/pincodes/import
 *
 * Chunked bulk import. Frontend sends rows in chunks (~10K per request).
 * Each chunk is written directly via raw SQL (bypasses Redis event bus).
 *
 * Body:
 *   rows         — array of row objects (pre-parsed by the frontend)
 *   mode         — "replace" (default) | "append"
 *   chunk_index  — 0-based chunk number
 *   total_chunks — total number of chunks
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const pgConnection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

  const {
    rows,
    mode = "replace",
    chunk_index = 0,
    total_chunks = 1,
  } = req.body as {
    rows?: Record<string, string>[]
    mode?: "replace" | "append"
    chunk_index?: number
    total_chunks?: number
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: "rows array is required and must not be empty" })
  }

  const isFirstChunk = chunk_index === 0

  try {
    // Clear existing records only on first chunk of a replace import
    if (mode === "replace" && isFirstChunk) {
      await pgConnection.raw(`DELETE FROM "serviceable_pincode"`)
      logger.info(`[pincode-import] Cleared existing records for fresh import`)
    }

    // Parse and validate rows
    let skipped = 0
    const validRows: any[] = []

    for (const row of rows) {
      const pincode = String(row.pincode ?? "").trim()
      if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
        skipped++
        continue
      }
      validRows.push({
        id: generateEntityId("", "svcpin"),
        pincode,
        officename: String(row.officename ?? "").trim() || "Unknown",
        officetype: row.officetype?.trim() || null,
        delivery: String(row.delivery ?? "").trim() || "Non Delivery",
        district: String(row.district ?? "").trim() || "Unknown",
        statename: String(row.statename ?? "").trim() || "Unknown",
        divisionname: row.divisionname?.trim() || null,
        regionname: row.regionname?.trim() || null,
        circlename: row.circlename?.trim() || null,
        latitude: (row.latitude?.trim() === "NA" || !row.latitude?.trim()) ? null : row.latitude.trim(),
        longitude: (row.longitude?.trim() === "NA" || !row.longitude?.trim()) ? null : row.longitude.trim(),
        is_serviceable: String(row.delivery ?? "").trim().toLowerCase() === "delivery",
      })
    }

    if (validRows.length === 0) {
      logger.warn(`[pincode-import] Chunk ${chunk_index}: all ${rows.length} rows invalid, 0 valid`)
      return res.status(200).json({
        success: true,
        imported: 0,
        skipped,
        chunk_index,
        total_chunks,
        is_last_chunk: chunk_index === total_chunks - 1,
      })
    }

    // Bulk insert via raw SQL in sub-batches.
    // Postgres max: 65,535 params per query. 13 cols × 4000 rows = 52,000 (safe margin).
    // Knex .raw() uses ? placeholders (not $1, $2).
    const COLS = [
      "id", "pincode", "officename", "officetype", "delivery", "district",
      "statename", "divisionname", "regionname", "circlename",
      "latitude", "longitude", "is_serviceable",
    ]
    const ROW_PH = `(${COLS.map(() => "?").join(", ")})`
    const SUB_BATCH = 4000

    for (let i = 0; i < validRows.length; i += SUB_BATCH) {
      const batch = validRows.slice(i, i + SUB_BATCH)
      const values: any[] = []

      for (const row of batch) {
        for (const col of COLS) {
          values.push(row[col])
        }
      }

      if (values.length > 0) {
        const allPlaceholders = batch.map(() => ROW_PH).join(", ")
        await pgConnection.raw(
          `INSERT INTO "serviceable_pincode" (${COLS.map(c => `"${c}"`).join(", ")})
           VALUES ${allPlaceholders}`,
          values
        )
      }
    }

    const imported = validRows.length

    logger.info(
      `[pincode-import] Chunk ${chunk_index + 1}/${total_chunks}: ${imported} imported, ${skipped} skipped`
    )

    return res.status(200).json({
      success: true,
      imported,
      skipped,
      chunk_index,
      total_chunks,
      is_last_chunk: chunk_index === total_chunks - 1,
    })
  } catch (error: any) {
    logger.error(`[pincode-import] Chunk ${chunk_index} failed: ${error.message}`)
    return res.status(500).json({
      message: error.message || "Import failed",
      chunk_index,
    })
  }
}
