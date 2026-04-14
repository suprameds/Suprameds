import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /store/pincodes/reverse-geocode?lat=17.3850&lng=78.4867
 *
 * Convert GPS coordinates to the nearest Indian pincode.
 *
 * Strategy:
 *   1. Search our serviceable_pincode table for the nearest pincode
 *      using the Haversine formula (if lat/lng data is populated)
 *   2. Fall back to BigDataCloud free reverse geocoding API
 *      (no API key required, returns Indian postal codes)
 *
 * Returns the pincode, district, state, and serviceability status.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const lat = parseFloat(req.query.lat as string)
  const lng = parseFloat(req.query.lng as string)

  if (isNaN(lat) || isNaN(lng) || lat < 6 || lat > 38 || lng < 68 || lng > 98) {
    // Bounding box for India: lat 6-38, lng 68-98
    return res.status(400).json({
      message: "Invalid coordinates. Must be within India.",
    })
  }

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  // ── Strategy 1: Search our own pincode database ──
  try {
    const pgConnection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

    // Haversine distance query — find nearest pincode with lat/lng data
    const result = await pgConnection.raw(`
      SELECT
        pincode,
        officename,
        district,
        statename AS state,
        is_serviceable,
        (
          6371 * acos(
            cos(radians(:lat)) * cos(radians(latitude::float))
            * cos(radians(longitude::float) - radians(:lng))
            + sin(radians(:lat)) * sin(radians(latitude::float))
          )
        ) AS distance_km
      FROM serviceable_pincode
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND latitude != ''
        AND longitude != ''
        AND deleted_at IS NULL
      ORDER BY distance_km ASC
      LIMIT 1
    `, { lat, lng })

    const rows = result?.rows ?? result?.[0] ?? []

    if (rows.length > 0 && rows[0].distance_km < 50) {
      // Found a pincode within 50km — good enough
      const row = rows[0]
      return res.json({
        pincode: row.pincode,
        district: row.district,
        state: row.state,
        serviceable: row.is_serviceable,
        source: "database",
        distance_km: Math.round(row.distance_km * 10) / 10,
      })
    }
  } catch (err) {
    logger.warn(`[reverse-geocode] DB lookup failed, falling back to API: ${err}`)
  }

  // ── Strategy 2: BigDataCloud free API (no key needed) ──
  try {
    const apiUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`BigDataCloud API returned ${response.status}`)
    }

    const data = await response.json() as {
      postcode?: string
      city?: string
      principalSubdivision?: string
      countryCode?: string
      locality?: string
    }

    if (!data.postcode || data.countryCode !== "IN") {
      return res.status(404).json({
        message: "Could not determine pincode for this location. Please enter it manually.",
      })
    }

    // Validate the returned pincode against our DB for serviceability
    try {
      const warehouseService = req.scope.resolve("warehouseModuleService") as any
      const check = await warehouseService.checkPincode(data.postcode)

      return res.json({
        pincode: data.postcode,
        district: check.district || data.city || "",
        state: check.state || data.principalSubdivision || "",
        serviceable: check.serviceable,
        source: "geocoding_api",
      })
    } catch {
      // DB check failed — still return the pincode, mark serviceability unknown
      return res.json({
        pincode: data.postcode,
        district: data.city || "",
        state: data.principalSubdivision || "",
        serviceable: null,
        source: "geocoding_api",
      })
    }
  } catch (err) {
    logger.warn(`[reverse-geocode] External API failed: ${err}`)
    return res.status(503).json({
      message: "Location lookup is temporarily unavailable. Please enter your pincode manually.",
    })
  }
}
