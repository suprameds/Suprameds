import { sdk } from "@/lib/utils/sdk"
import { useLocation } from "@/lib/hooks/use-location"
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
  /** Show "Use my location" button when no pincode is provided */
  showLocationButton?: boolean
}

/**
 * Checks pincode serviceability first (via /store/pincodes/check),
 * then falls back to state-based transit time from /store/delivery-estimate.
 * Supports GPS-based location detection via "Use my location" button.
 */
export const DeliveryEstimate = ({
  state,
  pincode,
  className,
  showLocationButton = false,
}: DeliveryEstimateProps) => {
  // Use GPS-detected pincode as fallback when no pincode prop provided
  const {
    pincode: detectedPincode,
    state: detectedState,
    isDetecting,
    error: locationError,
    detect,
  } = useLocation()

  const effectivePincode = pincode || detectedPincode || undefined
  const effectiveState = state || detectedState || undefined
  const hasLocation = Boolean(effectiveState || effectivePincode)

  const { data, isLoading, isError } = useQuery<NormalisedEstimate>({
    queryKey: ["delivery-estimate", effectiveState, effectivePincode],
    queryFn: async (): Promise<NormalisedEstimate> => {
      // Prefer pincode-based check when available
      if (effectivePincode && /^\d{6}$/.test(effectivePincode)) {
        const pincodeResult = await sdk.client.fetch<PincodeCheckResponse>(
          `/store/pincodes/check`,
          { method: "GET", query: { pincode: effectivePincode } }
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
      if (effectiveState) {
        const stateResult = await sdk.client.fetch<StateEstimateResponse>(
          `/store/delivery-estimate`,
          { method: "GET", query: { state: effectiveState } }
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
      <div className={clsx("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2.5 text-xs" style={{ color: "var(--text-primary)" }}>
          <TruckIcon />
          <span>
            <strong style={{ color: "var(--text-primary)" }}>Delivery in 2–7 business days</strong> across India
          </span>
        </div>
        {showLocationButton && (
          <button
            type="button"
            onClick={() => detect()}
            disabled={isDetecting}
            className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-50 cursor-pointer"
            style={{ color: "var(--brand-teal)" }}
          >
            <LocationIcon />
            {isDetecting ? "Detecting location..." : "Use my location for delivery estimate"}
          </button>
        )}
        {locationError && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {locationError}. Enter pincode at checkout.
          </p>
        )}
      </div>
    )
  }

  if (isLoading || isDetecting) {
    return (
      <div className={clsx("flex items-center gap-2.5 text-xs", className)} style={{ color: "#999" }}>
        <TruckIcon muted />
        <span className="animate-pulse">{isDetecting ? "Detecting your location…" : "Calculating delivery estimate…"}</span>
      </div>
    )
  }

  if (data && !data.serviceable) {
    return (
      <div className={clsx("flex items-center gap-2.5 text-xs", className)} style={{ color: "var(--brand-red)" }}>
        <TruckIcon color="var(--brand-red)" />
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
      <div className="flex items-center gap-2.5 text-xs" style={{ color: "var(--text-primary)" }}>
        <TruckIcon />
        <span>
          Estimated delivery: <strong style={{ color: "var(--text-primary)" }}>{daysText}</strong>
        </span>
      </div>
      {free_delivery_threshold > 0 && (
        <div className="flex items-center gap-2.5 text-xs" style={{ color: "var(--text-primary)" }}>
          <TagIcon />
          <span>
            <strong style={{ color: "var(--price-color)" }}>FREE delivery</strong> on orders above ₹{free_delivery_threshold}
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
      stroke={color ?? (muted ? "#999" : "var(--brand-teal)")}
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
      stroke="var(--brand-green)"
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

function LocationIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  )
}

export default DeliveryEstimate
