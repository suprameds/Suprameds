import { sdk } from "@/lib/utils/sdk"
import { useQuery } from "@tanstack/react-query"
import { clsx } from "clsx"

/** Response from /store/pincodes/check */
type PincodeCheckResponse = {
  serviceable: boolean
  pincode?: string
  district?: string
  state?: string
  estimated_delivery?: string
  free_delivery_above?: number
  message: string
}

/** Response from /store/delivery-estimate (state-based fallback) */
type StateEstimateResponse = {
  min_days: number
  max_days: number
  display_text: string
  is_same_state: boolean
  free_delivery_above: number
}

/** Normalised shape used internally */
type NormalisedEstimate = {
  serviceable: boolean
  min_days: number
  max_days: number
  free_delivery_threshold: number
}

interface DeliveryEstimateProps {
  state?: string
  pincode?: string
  className?: string
}

/**
 * Checks pincode serviceability first (via /store/pincodes/check),
 * then falls back to state-based transit time from /store/delivery-estimate.
 */
export const DeliveryEstimate = ({
  state,
  pincode,
  className,
}: DeliveryEstimateProps) => {
  const hasLocation = Boolean(state || pincode)

  const { data, isLoading, isError } = useQuery<NormalisedEstimate>({
    queryKey: ["delivery-estimate", state, pincode],
    queryFn: async (): Promise<NormalisedEstimate> => {
      // Prefer pincode-based check when available
      if (pincode && /^\d{6}$/.test(pincode)) {
        const pincodeResult = await sdk.client.fetch<PincodeCheckResponse>(
          `/store/pincodes/check`,
          { method: "GET", query: { pincode } }
        )

        if (!pincodeResult.serviceable) {
          return { serviceable: false, min_days: 0, max_days: 0, free_delivery_threshold: 0 }
        }

        // Parse estimated_delivery string like "3-5 business days"
        const match = pincodeResult.estimated_delivery?.match(/(\d+)[\s–-]+(\d+)/)
        const min = match ? parseInt(match[1], 10) : 3
        const max = match ? parseInt(match[2], 10) : 7

        return {
          serviceable: true,
          min_days: min,
          max_days: max,
          free_delivery_threshold: pincodeResult.free_delivery_above ?? 300,
        }
      }

      // Fallback to state-based estimate
      if (state) {
        const stateResult = await sdk.client.fetch<StateEstimateResponse>(
          `/store/delivery-estimate`,
          { method: "GET", query: { state } }
        )
        return {
          serviceable: true,
          min_days: stateResult.min_days,
          max_days: stateResult.max_days,
          free_delivery_threshold: stateResult.free_delivery_above,
        }
      }

      return { serviceable: true, min_days: 2, max_days: 7, free_delivery_threshold: 300 }
    },
    enabled: hasLocation,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  if (!hasLocation || isError) {
    return (
      <div className={clsx("flex items-center gap-2.5 text-xs", className)} style={{ color: "#2C3E50" }}>
        <TruckIcon />
        <span>
          <strong style={{ color: "#0D1B2A" }}>Delivery in 2–7 business days</strong> across India
        </span>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={clsx("flex items-center gap-2.5 text-xs", className)} style={{ color: "#999" }}>
        <TruckIcon muted />
        <span className="animate-pulse">Calculating delivery estimate…</span>
      </div>
    )
  }

  if (data && !data.serviceable) {
    return (
      <div className={clsx("flex items-center gap-2.5 text-xs", className)} style={{ color: "#C0392B" }}>
        <TruckIcon color="#C0392B" />
        <span>Delivery not available to this location</span>
      </div>
    )
  }

  if (!data) return null

  const { min_days, max_days, free_delivery_threshold } = data
  const isSameDay = min_days === max_days
  const daysText = isSameDay
    ? `${min_days} business day${min_days > 1 ? "s" : ""}`
    : `${min_days}–${max_days} business days`

  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2.5 text-xs" style={{ color: "#2C3E50" }}>
        <TruckIcon />
        <span>
          Estimated delivery: <strong style={{ color: "#0D1B2A" }}>{daysText}</strong>
        </span>
      </div>
      {free_delivery_threshold > 0 && (
        <div className="flex items-center gap-2.5 text-xs" style={{ color: "#2C3E50" }}>
          <TagIcon />
          <span>
            <strong style={{ color: "#1A7A4A" }}>FREE delivery</strong> on orders above ₹{free_delivery_threshold}
          </span>
        </div>
      )}
    </div>
  )
}

function TruckIcon({ muted, color }: { muted?: boolean; color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? (muted ? "#999" : "#0E7C86")}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#27AE60"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

export default DeliveryEstimate
