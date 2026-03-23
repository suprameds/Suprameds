import { MedusaContainer } from "@medusajs/framework/types"
import { SHIPMENT_MODULE } from "../modules/shipment"

const LOG = "[job:update-delivery-days]"

/**
 * Weekly job (Sunday 02:00 UTC) — refreshes delivery day estimates
 * for state-level lookup. Uses India Post Speed Post standard times.
 *
 * The warehouse is in Telangana. Estimates are conservative ranges
 * that account for India Post's published delivery standards.
 */

const DELIVERY_MATRIX: Array<{
  dest_state: string
  city_type: "metro" | "tier2" | "tier3" | "rural"
  min_days: number
  max_days: number
}> = [
  // South India (warehouse region) — fastest
  { dest_state: "Telangana", city_type: "metro", min_days: 1, max_days: 2 },
  { dest_state: "Telangana", city_type: "tier2", min_days: 2, max_days: 3 },
  { dest_state: "Telangana", city_type: "rural", min_days: 3, max_days: 5 },
  { dest_state: "Andhra Pradesh", city_type: "metro", min_days: 2, max_days: 3 },
  { dest_state: "Andhra Pradesh", city_type: "tier2", min_days: 3, max_days: 4 },
  { dest_state: "Andhra Pradesh", city_type: "rural", min_days: 4, max_days: 6 },
  { dest_state: "Karnataka", city_type: "metro", min_days: 2, max_days: 3 },
  { dest_state: "Karnataka", city_type: "tier2", min_days: 3, max_days: 5 },
  { dest_state: "Tamil Nadu", city_type: "metro", min_days: 2, max_days: 4 },
  { dest_state: "Tamil Nadu", city_type: "tier2", min_days: 3, max_days: 5 },
  { dest_state: "Kerala", city_type: "metro", min_days: 3, max_days: 5 },

  // West India
  { dest_state: "Maharashtra", city_type: "metro", min_days: 3, max_days: 5 },
  { dest_state: "Maharashtra", city_type: "tier2", min_days: 4, max_days: 6 },
  { dest_state: "Gujarat", city_type: "metro", min_days: 4, max_days: 6 },
  { dest_state: "Goa", city_type: "metro", min_days: 3, max_days: 5 },
  { dest_state: "Rajasthan", city_type: "metro", min_days: 4, max_days: 7 },

  // North India
  { dest_state: "Delhi", city_type: "metro", min_days: 3, max_days: 5 },
  { dest_state: "Uttar Pradesh", city_type: "metro", min_days: 4, max_days: 6 },
  { dest_state: "Uttar Pradesh", city_type: "tier2", min_days: 5, max_days: 7 },
  { dest_state: "Madhya Pradesh", city_type: "metro", min_days: 4, max_days: 6 },
  { dest_state: "Punjab", city_type: "metro", min_days: 4, max_days: 6 },
  { dest_state: "Haryana", city_type: "metro", min_days: 4, max_days: 6 },

  // East India
  { dest_state: "West Bengal", city_type: "metro", min_days: 4, max_days: 6 },
  { dest_state: "Odisha", city_type: "metro", min_days: 4, max_days: 6 },
  { dest_state: "Bihar", city_type: "metro", min_days: 5, max_days: 7 },
  { dest_state: "Jharkhand", city_type: "metro", min_days: 5, max_days: 7 },

  // Northeast
  { dest_state: "Assam", city_type: "metro", min_days: 5, max_days: 8 },
  { dest_state: "Meghalaya", city_type: "metro", min_days: 6, max_days: 9 },

  // Himalayas
  { dest_state: "Uttarakhand", city_type: "metro", min_days: 5, max_days: 7 },
  { dest_state: "Himachal Pradesh", city_type: "metro", min_days: 5, max_days: 8 },
  { dest_state: "Jammu and Kashmir", city_type: "metro", min_days: 6, max_days: 9 },
]

const ORIGIN_STATE = "Telangana"

export default async function UpdateDeliveryDaysJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any
  logger.info(`${LOG} Starting weekly delivery estimate refresh`)

  try {
    const shipmentService = container.resolve(SHIPMENT_MODULE) as any

    let upserted = 0
    for (const entry of DELIVERY_MATRIX) {
      try {
        // Check if entry already exists
        const existing = await shipmentService.listDeliveryDaysLookups(
          {
            origin_state: ORIGIN_STATE,
            dest_state: entry.dest_state,
            city_type: entry.city_type,
          },
          { take: 1 }
        )

        const displayText = `${entry.min_days}-${entry.max_days} business days`

        if (existing?.length > 0) {
          await shipmentService.updateDeliveryDaysLookups(existing[0].id, {
            min_days: entry.min_days,
            max_days: entry.max_days,
            display_text: displayText,
          })
        } else {
          await shipmentService.createDeliveryDaysLookups({
            origin_state: ORIGIN_STATE,
            dest_state: entry.dest_state,
            city_type: entry.city_type,
            min_days: entry.min_days,
            max_days: entry.max_days,
            display_text: displayText,
          })
        }
        upserted++
      } catch (err) {
        logger.warn(
          `${LOG} Failed for ${entry.dest_state}/${entry.city_type}: ${(err as Error).message}`
        )
      }
    }

    logger.info(`${LOG} Upserted ${upserted}/${DELIVERY_MATRIX.length} delivery estimates`)
  } catch (err) {
    logger.error(`${LOG} Failed: ${(err as Error).message}`)
  }
}

export const config = {
  name: "update-delivery-days",
  schedule: "0 2 * * 0",
}
