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
  const isRTO = shipment.status === "rto"
  const current = activeStageIndex(shipment.status)
  const estimatedDate = formatDate(shipment.estimated_delivery)
  const deliveredDate = formatDate(shipment.actual_delivery)

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
          <span className="text-xs" style={{ color: GREY_TEXT }}>
            AWB: {shipment.awb_number}
          </span>
        </div>

        <div className="flex items-center gap-3">
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
