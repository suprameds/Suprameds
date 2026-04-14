import { useState, useEffect } from "react"

interface NetworkQuality {
  /** True on 2G/3G connections */
  isSlow: boolean
  /** Raw effective type: "slow-2g", "2g", "3g", "4g" */
  effectiveType: string
}

/**
 * Detects network quality using the Network Information API.
 * Available in Android Chrome/WebView. Returns safe defaults on unsupported browsers.
 */
export function useNetworkQuality(): NetworkQuality {
  const [quality, setQuality] = useState<NetworkQuality>(() => getQuality())

  useEffect(() => {
    const conn = (navigator as any).connection
    if (!conn) return

    const handler = () => setQuality(getQuality())
    conn.addEventListener("change", handler)
    return () => conn.removeEventListener("change", handler)
  }, [])

  return quality
}

function getQuality(): NetworkQuality {
  if (typeof navigator === "undefined") return { isSlow: false, effectiveType: "4g" }
  const conn = (navigator as any).connection
  if (!conn) return { isSlow: false, effectiveType: "4g" }

  const type = conn.effectiveType || "4g"
  return {
    isSlow: type === "slow-2g" || type === "2g" || type === "3g",
    effectiveType: type,
  }
}
