import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * GET /store/products/substitutes?product_id=xxx
 *
 * Returns up to 5 cheaper therapeutic substitutes that share the same
 * composition as the requested product but from a different brand.
 *
 * Uses raw SQL because we need to join drug_product, product, and
 * product_variant_price_set + price tables for accurate price comparison.
 *
 * Results are sorted by unit_price ascending (cheapest first).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productId = (req.query.product_id as string)?.trim()
  if (!productId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Missing required query param: product_id"
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  // Step 1: Get the source product's drug metadata
  const { data: sourceDrugs } = await query.graph({
    entity: "drug_product",
    fields: ["id", "product_id", "composition", "generic_name", "mrp_paise"],
    filters: { product_id: productId },
  })

  const sourceDrug = (sourceDrugs as any[])?.[0]
  if (!sourceDrug?.composition) {
    return res.json({ substitutes: [] })
  }

  // Normalise composition for comparison (lowercase, trimmed)
  const normalisedComposition = sourceDrug.composition.toLowerCase().trim()

  try {
    // Step 2: Find all drug_products with matching composition, excluding the source
    const pgConnection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

    const result = await pgConnection.raw(
      `
      SELECT
        p."id"                  AS product_id,
        p."title",
        p."thumbnail",
        p."handle",
        dp."id"                 AS drug_product_id,
        dp."generic_name",
        dp."composition",
        dp."strength",
        dp."dosage_form",
        dp."schedule",
        dp."mrp_paise",
        -- Get the lowest published variant price for INR
        (
          SELECT MIN(pr."amount")
          FROM "product_variant" pv
          INNER JOIN "product_variant_price_set" pvps ON pvps."variant_id" = pv."id"
          INNER JOIN "price" pr ON pr."price_set_id" = pvps."price_set_id"
          WHERE pv."product_id" = p."id"
            AND pv."deleted_at" IS NULL
            AND pr."deleted_at" IS NULL
            AND pr."currency_code" = 'inr'
        ) AS unit_price
      FROM "drug_product" dp
      INNER JOIN "product" p ON p."id" = dp."product_id" AND p."deleted_at" IS NULL AND p."status" = 'published'
      WHERE dp."deleted_at" IS NULL
        AND dp."product_id" != :sourceProductId
        AND LOWER(TRIM(dp."composition")) = :composition
        AND dp."schedule" NOT IN ('X')
      ORDER BY unit_price ASC NULLS LAST
      LIMIT 5
      `,
      {
        sourceProductId: productId,
        composition: normalisedComposition,
      }
    )

    const rows = result?.rows ?? result?.[0] ?? []

    // Calculate savings relative to source product's MRP or unit price
    const sourceMrp = sourceDrug.mrp_paise ? Number(sourceDrug.mrp_paise) : null

    const substitutes = rows.map((row: Record<string, unknown>) => {
      const subPrice = row.unit_price ? Number(row.unit_price) : null
      const subMrp = row.mrp_paise ? Number(row.mrp_paise) : null

      let savings_pct: number | null = null
      if (sourceMrp && subMrp && subMrp < sourceMrp) {
        savings_pct = Math.round(((sourceMrp - subMrp) / sourceMrp) * 100)
      }

      return {
        id: row.product_id,
        title: row.title,
        handle: row.handle,
        thumbnail: row.thumbnail,
        generic_name: row.generic_name,
        composition: row.composition,
        strength: row.strength,
        dosage_form: row.dosage_form,
        schedule: row.schedule,
        unit_price: subPrice,
        mrp: subMrp,
        savings_pct,
      }
    })

    return res.json({ substitutes })
  } catch (error) {
    logger.error("[substitutes] Query failed:", error)
    return res.status(500).json({
      message: "Unable to fetch substitutes at this time.",
    })
  }
}
