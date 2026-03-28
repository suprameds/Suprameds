import { sdk } from "@/lib/utils/sdk"
import { useEffect, useState } from "react"

// ---------- Types ----------

type ShipmentItem = {
  product_title: string
  quantity: number
}

type Shipment = {
  id: string
  carrier: string
  awb_number: string
  status: string
  dispatched_at: string | null
  estimated_delivery: string | null
  actual_delivery: string | null
  tracking_url: string | null
  items: ShipmentItem[]
}

type ShipmentResponse = {
  shipments: Shipment[]
}

// ---------- Stage definitions ----------

const STAGES = [
  { key: "order_placed", label: "Order Placed" },
  { key: "processing", label: "Processing" },
  { key: "dispatched", label: "Dispatched" },
  { key: "in_transit", label: "In Transit" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
] as const

type StageKey = (typeof STAGES)[number]["key"]

const STATUS_TO_STAGE: Record<string, StageKey> = {
  pending: "processing",
  processing: "processing",
  dispatched: "dispatched",
  in_transit: "in_transit",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
}

const STATUS_DISPLAY: Record<string, string> = {
  dispatched: "Dispatched",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  rto: "Returning to Warehouse",
}

/** Returns 0-based index of the active stage, or -1 for unknown */
function activeStageIndex(status: string): number {
  const stageKey = STATUS_TO_STAGE[status]
  if (!stageKey) return 1 // default to "Processing" for unknown statuses
  return STAGES.findIndex((s) => s.key === stageKey)
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Build a direct tracking URL for known Indian carriers */
function getCarrierTrackingUrl(carrier: string, awb: string): string | null {
  const c = carrier?.toLowerCase()
  if (c?.includes("india-post") || c?.includes("speed-post") || c?.includes("indiapost"))
    return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?search=${awb}`
  if (c?.includes("dtdc"))
    return `https://www.dtdc.in/tracking.asp?strCnno=${awb}`
  if (c?.includes("delhivery"))
    return `https://www.delhivery.com/track/package/${awb}`
  if (c?.includes("bluedart"))
    return `https://www.bluedart.com/tracking?handler=tnt&action=awbquery&awb=${awb}`
  return null
}

/** Human-friendly delivery countdown / status string */
function getDeliveryStatus(estimated: string | null, actual: string | null): string | null {
  if (actual) {
    return `Delivered on ${new Date(actual).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
  }
  if (!estimated) return null
  const est = new Date(estimated)
  const now = new Date()
  const diffDays = Math.ceil((est.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return "Delivery delayed"
  if (diffDays === 0) return "Arriving today"
  if (diffDays === 1) return "Arriving tomorrow"
  return `Arriving in ${diffDays} days`
}

// ---------- Colors ----------

const TEAL = "var(--brand-teal)"
const TEAL_BG = "#F0FDFA"
const GREY = "#D1D5DB"
const GREY_TEXT = "var(--text-tertiary)"
const NAVY = "var(--text-primary)"
const RTO_RED = "var(--brand-red)"

// ---------- Component ----------

export const ShipmentTracker = ({ orderId }: { orderId: string }) => {
  const [shipments, setShipments] = useState<Shipment[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchShipments() {
      try {
        const data = await sdk.client.fetch<ShipmentResponse>(
          `/store/shipments?order_id=${encodeURIComponent(orderId)}`,
          { method: "GET" }
        )
        if (!cancelled) setShipments(data.shipments ?? [])
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchShipments()
    return () => { cancelled = true }
  }, [orderId])

  if (loading) {
    return (
      <div className="rounded-xl border p-5" style={{ borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: TEAL, borderTopColor: "transparent" }} />
          <span className="text-sm" style={{ color: GREY_TEXT }}>Loading shipment info…</span>
        </div>
      </div>
    )
  }

  if (error || !shipments) return null

  if (shipments.length === 0) {
    return (
      <div className="rounded-xl border p-5" style={{ borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}>
        <div className="flex items-center gap-3">
          <PackageIcon />
          <div>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>Preparing your order for dispatch</p>
            <p className="text-xs mt-0.5" style={{ color: GREY_TEXT }}>
              We'll update tracking details once your order ships.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {shipments.map((shipment) => (
        <ShipmentCard key={shipment.id} shipment={shipment} />
      ))}
    </div>
  )
}

// ---------- Single Shipment Card ----------

const ShipmentCard = ({ shipment }: { shipment: Shipment }) => {
  const [copied, setCopied] = useState(false)
  const isRTO = shipment.status === "rto"
  const current = activeStageIndex(shipment.status)
  const estimatedDate = formatDate(shipment.estimated_delivery)
  const deliveredDate = formatDate(shipment.actual_delivery)
  const carrierTrackingUrl = getCarrierTrackingUrl(shipment.carrier, shipment.awb_number)
  const deliveryStatus = getDeliveryStatus(shipment.estimated_delivery, shipment.actual_delivery)

  const handleCopyAwb = () => {
    navigator.clipboard.writeText(shipment.awb_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: NAVY }}>
              {shipment.carrier}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
              background: isRTO ? "rgba(192,57,43,0.08)" : TEAL_BG,
              color: isRTO ? RTO_RED : TEAL,
            }}>
              {STATUS_DISPLAY[shipment.status] ?? shipment.status}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyAwb}
              className="inline-flex items-center gap-1 text-xs font-mono transition-colors"
              style={{ color: copied ? TEAL : GREY_TEXT }}
              title="Copy tracking number"
            >
              AWB: {shipment.awb_number}
              {copied ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            {carrierTrackingUrl && (
              <a
                href={carrierTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs hover:underline"
                style={{ color: TEAL }}
              >
                Track on carrier website
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {estimatedDate && shipment.status !== "delivered" && (
            <span className="text-xs" style={{ color: GREY_TEXT }}>
              Est. delivery: <strong style={{ color: NAVY }}>{estimatedDate}</strong>
            </span>
          )}
          {deliveredDate && shipment.status === "delivered" && (
            <span className="text-xs" style={{ color: "var(--price-color)" }}>
              Delivered: <strong>{deliveredDate}</strong>
            </span>
          )}
          {deliveryStatus && (
            <span
              className="inline-block px-2 py-0.5 rounded text-xs font-medium"
              style={{
                background: deliveryStatus.includes("Delivered")
                  ? "rgba(39,174,96,0.10)"
                  : deliveryStatus.includes("delayed")
                    ? "rgba(192,57,43,0.10)"
                    : "rgba(243,156,18,0.10)",
                color: deliveryStatus.includes("Delivered")
                  ? TEAL
                  : deliveryStatus.includes("delayed")
                    ? RTO_RED
                    : "var(--brand-amber, #F39C12)",
              }}
            >
              {deliveryStatus}
            </span>
          )}
          {shipment.tracking_url && (
            <a
              href={shipment.tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:opacity-80"
              style={{ color: TEAL, borderColor: TEAL, background: TEAL_BG }}
            >
              <ExternalLinkIcon />
              Track Package
            </a>
          )}
        </div>
      </div>

      {/* RTO banner */}
      {isRTO && (
        <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: "rgba(192,57,43,0.06)", borderBottom: "1px solid rgba(192,57,43,0.15)" }}>
          <ReturnIcon />
          <span className="text-xs font-medium" style={{ color: RTO_RED }}>
            This shipment is being returned to our warehouse.
          </span>
        </div>
      )}

      {/* Timeline */}
      {!isRTO && (
        <div className="px-5 py-5">
          {/* Desktop: horizontal */}
          <div className="hidden sm:flex items-start justify-between relative">
            {STAGES.map((stage, i) => {
              const isLast = i === STAGES.length - 1
              const isCompleted = i < current
              const isActive = i === current
              const isPending = i > current

              return (
                <div key={stage.key} className="flex flex-col items-center flex-1 relative">
                  {!isLast && (
                    <div
                      className="absolute top-3 h-0.5 z-0"
                      style={{
                        left: "50%",
                        right: "-50%",
                        background: isCompleted && !isPending ? TEAL : "#E5E7EB",
                      }}
                    />
                  )}
                  <div
                    className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all"
                    style={{
                      borderColor: isCompleted || isActive ? TEAL : GREY,
                      background: isCompleted ? TEAL : isActive ? TEAL_BG : "var(--bg-secondary)",
                    }}
                  >
                    {isCompleted ? (
                      <StageCheckIcon />
                    ) : isActive ? (
                      <div className="w-2 h-2 rounded-full" style={{ background: TEAL }} />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: GREY }} />
                    )}
                  </div>
                  <p
                    className="text-[11px] font-semibold mt-1.5 text-center leading-tight"
                    style={{ color: isCompleted || isActive ? TEAL : GREY_TEXT }}
                  >
                    {stage.label}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Mobile: vertical */}
          <div className="sm:hidden flex flex-col gap-0">
            {STAGES.map((stage, i) => {
              const isLast = i === STAGES.length - 1
              const isCompleted = i < current
              const isActive = i === current

              return (
                <div key={stage.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className="flex items-center justify-center w-5 h-5 rounded-full border-2 flex-shrink-0"
                      style={{
                        borderColor: isCompleted || isActive ? TEAL : GREY,
                        background: isCompleted ? TEAL : isActive ? TEAL_BG : "var(--bg-secondary)",
                      }}
                    >
                      {isCompleted ? (
                        <StageCheckIcon size={10} />
                      ) : isActive ? (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: TEAL }} />
                      ) : (
                        <div className="w-1 h-1 rounded-full" style={{ background: GREY }} />
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className="w-0.5 flex-1 min-h-[20px]"
                        style={{ background: isCompleted ? TEAL : "#E5E7EB" }}
                      />
                    )}
                  </div>
                  <div className="pb-3 -mt-0.5">
                    <p
                      className="text-xs font-semibold"
                      style={{ color: isCompleted || isActive ? TEAL : GREY_TEXT }}
                    >
                      {stage.label}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Items in this shipment */}
      {shipment.items.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-xs font-semibold mb-2" style={{ color: NAVY }}>Items in this shipment</p>
          <div className="flex flex-col gap-1">
            {shipment.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>{item.product_title}</span>
                <span>×{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Icons ----------

const PackageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
)

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)

const ReturnIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={RTO_RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
)

const StageCheckIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default ShipmentTracker
