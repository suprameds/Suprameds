import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect, useRef, useState } from "react"

const POLL_INTERVAL = 30_000 // 30 seconds

/**
 * Auto-refresh widget for the orders list page.
 * Polls every 30s, shows a banner when new orders arrive.
 */
const OrderAutoRefresh = () => {
  const [newCount, setNewCount] = useState(0)
  const lastCountRef = useRef<number | null>(null)
  const [lastChecked, setLastChecked] = useState<string>("")

  useEffect(() => {
    const check = async () => {
      try {
        const resp = await fetch(
          "/admin/orders?fields=id&limit=1&order=-created_at",
          { credentials: "include" }
        )
        if (!resp.ok) return
        const { count } = await resp.json()

        if (lastCountRef.current !== null && count > lastCountRef.current) {
          setNewCount(count - lastCountRef.current)
        }
        lastCountRef.current = count
        setLastChecked(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }))
      } catch { /* ignore fetch errors */ }
    }

    check()
    const interval = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setNewCount(0)
    window.location.reload()
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 4px 0" }}>
      {newCount > 0 ? (
        <button
          onClick={handleRefresh}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8,
            padding: "8px 16px", cursor: "pointer", width: "100%",
            fontSize: 13, fontWeight: 600, color: "#065F46",
          }}
        >
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#10B981", animation: "pulse 1.5s infinite" }} />
          {newCount} new order{newCount > 1 ? "s" : ""} — click to refresh
        </button>
      ) : (
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>
          {lastChecked ? `Auto-checking every 30s · Last: ${lastChecked}` : "Checking for new orders..."}
        </span>
      )}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "order.list.before",
})

export default OrderAutoRefresh
