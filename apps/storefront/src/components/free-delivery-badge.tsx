import { sdk } from "@/lib/utils/sdk"
import { useQuery } from "@tanstack/react-query"
import { clsx } from "clsx"

type ThresholdResponse = {
  free_delivery_threshold: number
}

interface FreeDeliveryBadgeProps {
  /** Override the threshold instead of fetching from the API */
  threshold?: number
  className?: string
}

/**
 * Small green badge: "Free delivery on orders above ₹X".
 * Fetches the threshold from the delivery-estimate API or uses the static prop.
 */
export const FreeDeliveryBadge = ({
  threshold: staticThreshold,
  className,
}: FreeDeliveryBadgeProps) => {
  const shouldFetch = staticThreshold === undefined

  const { data } = useQuery<ThresholdResponse>({
    queryKey: ["free-delivery-threshold"],
    queryFn: () =>
      sdk.client.fetch<ThresholdResponse>("/store/delivery-estimate", {
        method: "GET",
      }),
    enabled: shouldFetch,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  const amount = staticThreshold ?? data?.free_delivery_threshold ?? 300

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        className
      )}
      style={{
        background: "rgba(26,122,74,0.08)",
        color: "var(--price-color)",
        border: "1px solid rgba(26,122,74,0.20)",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
      Free delivery on orders above ₹{amount}
    </span>
  )
}

export default FreeDeliveryBadge
