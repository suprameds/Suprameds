const AFTERSHIP_BASE = "https://api.aftership.com/v4"
const DEFAULT_CARRIER = "india-post"

export function isAfterShipConfigured(): boolean {
  return Boolean(process.env.AFTERSHIP_API_KEY)
}

function getHeaders(): Record<string, string> {
  const key = process.env.AFTERSHIP_API_KEY
  if (!key) {
    throw new Error("[aftership] AFTERSHIP_API_KEY is not set — cannot make API calls")
  }
  return {
    "aftership-api-key": key,
    "Content-Type": "application/json",
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AfterShipStatus =
  | "Pending"
  | "InfoReceived"
  | "InTransit"
  | "OutForDelivery"
  | "AttemptFail"
  | "Delivered"
  | "AvailableForPickup"
  | "Exception"
  | "Expired"

export type ShipmentStatus =
  | "label_created"
  | "in_transit"
  | "out_for_delivery"
  | "delivery_attempted"
  | "delivered"
  | "ndr"
  | "rto_initiated"
  | "rto_delivered"

// ---------------------------------------------------------------------------
// Status normalisation
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, ShipmentStatus> = {
  Pending: "label_created",
  InfoReceived: "label_created",
  InTransit: "in_transit",
  OutForDelivery: "out_for_delivery",
  AttemptFail: "delivery_attempted",
  Delivered: "delivered",
  AvailableForPickup: "delivered",
  Exception: "ndr",
  Expired: "ndr",
}

/**
 * Map an AfterShip tag (+ optional subtag) to our internal shipment status.
 * RTO sub-tags override the base mapping so we can distinguish return shipments.
 */
export function normalizeAfterShipStatus(
  aftershipTag: string,
  subtag?: string
): ShipmentStatus {
  if (subtag) {
    const upper = subtag.toUpperCase()
    if (upper.includes("RTO")) {
      // "Exception_011" / "RTO" / "Returning to Sender" etc.
      return aftershipTag === "Delivered" ? "rto_delivered" : "rto_initiated"
    }
  }
  return STATUS_MAP[aftershipTag] ?? "in_transit"
}

// ---------------------------------------------------------------------------
// Create tracking
// ---------------------------------------------------------------------------

export async function createTracking(params: {
  awb_number: string
  order_id: string
  order_number?: string
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  origin_city?: string
  destination_city?: string
}): Promise<{ tracking_id: string; slug: string } | null> {
  try {
    const body: Record<string, unknown> = {
      tracking: {
        slug: DEFAULT_CARRIER,
        tracking_number: params.awb_number,
        order_id: params.order_number ?? params.order_id,
        custom_fields: { order_id: params.order_id },
        ...(params.customer_name && {
          customer_name: params.customer_name,
        }),
        ...(params.origin_city && {
          origin_city: params.origin_city,
        }),
        ...(params.destination_city && {
          destination_city: params.destination_city,
        }),
        ...(params.customer_email && {
          emails: [params.customer_email],
        }),
        ...(params.customer_phone && {
          smses: [{ phone_number: params.customer_phone }],
        }),
      },
    }

    const res = await fetch(`${AFTERSHIP_BASE}/trackings`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn(
        `[aftership] createTracking failed (${res.status}):`,
        JSON.stringify(err)
      )
      return null
    }

    const json = (await res.json()) as {
      data: { tracking: { id: string; slug: string } }
    }
    const tracking = json.data.tracking

    console.info(
      `[aftership] tracking created — id=${tracking.id} awb=${params.awb_number}`
    )
    return { tracking_id: tracking.id, slug: tracking.slug }
  } catch (error) {
    console.warn("[aftership] createTracking error:", error)
    return null
  }
}

// ---------------------------------------------------------------------------
// Get tracking status
// ---------------------------------------------------------------------------

export async function getTrackingStatus(
  slug: string,
  awbNumber: string
): Promise<{
  tag: AfterShipStatus
  subtag?: string
  checkpoints: Array<{
    tag: string
    message: string
    location: string
    checkpoint_time: string
  }>
  signed_by?: string
} | null> {
  try {
    const res = await fetch(
      `${AFTERSHIP_BASE}/trackings/${slug}/${awbNumber}`,
      { method: "GET", headers: getHeaders() }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn(
        `[aftership] getTrackingStatus failed (${res.status}):`,
        JSON.stringify(err)
      )
      return null
    }

    const json = (await res.json()) as {
      data: {
        tracking: {
          tag: AfterShipStatus
          subtag?: string
          signed_by?: string
          checkpoints: Array<{
            tag: string
            message: string
            location: string
            checkpoint_time: string
          }>
        }
      }
    }

    const t = json.data.tracking
    return {
      tag: t.tag,
      subtag: t.subtag,
      signed_by: t.signed_by,
      checkpoints: (t.checkpoints ?? []).map((cp) => ({
        tag: cp.tag,
        message: cp.message ?? "",
        location: cp.location ?? "",
        checkpoint_time: cp.checkpoint_time,
      })),
    }
  } catch (error) {
    console.warn("[aftership] getTrackingStatus error:", error)
    return null
  }
}

// ---------------------------------------------------------------------------
// Delete tracking
// ---------------------------------------------------------------------------

export async function deleteTracking(
  slug: string,
  awbNumber: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${AFTERSHIP_BASE}/trackings/${slug}/${awbNumber}`,
      { method: "DELETE", headers: getHeaders() }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn(
        `[aftership] deleteTracking failed (${res.status}):`,
        JSON.stringify(err)
      )
      return false
    }

    console.info(`[aftership] tracking deleted — slug=${slug} awb=${awbNumber}`)
    return true
  } catch (error) {
    console.warn("[aftership] deleteTracking error:", error)
    return false
  }
}

// ---------------------------------------------------------------------------
// List active trackings (paginated — for sync jobs)
// ---------------------------------------------------------------------------

export async function listActiveTrackings(
  page = 1
): Promise<
  Array<{
    id: string
    tracking_number: string
    slug: string
    tag: AfterShipStatus
    subtag?: string
    order_id?: string
  }>
> {
  try {
    const url = new URL(`${AFTERSHIP_BASE}/trackings`)
    url.searchParams.set("page", String(page))
    url.searchParams.set("limit", "100")
    // Only fetch non-terminal shipments
    url.searchParams.set(
      "tag",
      "Pending,InfoReceived,InTransit,OutForDelivery,AttemptFail,Exception"
    )

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getHeaders(),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn(
        `[aftership] listActiveTrackings failed (${res.status}):`,
        JSON.stringify(err)
      )
      return []
    }

    const json = (await res.json()) as {
      data: {
        trackings: Array<{
          id: string
          tracking_number: string
          slug: string
          tag: AfterShipStatus
          subtag?: string
          custom_fields?: { order_id?: string }
          order_id?: string
        }>
      }
    }

    return json.data.trackings.map((t) => ({
      id: t.id,
      tracking_number: t.tracking_number,
      slug: t.slug,
      tag: t.tag,
      subtag: t.subtag,
      order_id: t.custom_fields?.order_id ?? t.order_id,
    }))
  } catch (error) {
    console.warn("[aftership] listActiveTrackings error:", error)
    return []
  }
}
