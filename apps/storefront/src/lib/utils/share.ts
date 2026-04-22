import { isNativeApp } from "@/lib/utils/capacitor"

export type ShareInput = {
  title?: string
  text?: string
  url: string
  dialogTitle?: string
}

/**
 * Share a URL via the native share sheet (Android/iOS) or the Web Share API.
 * Falls back to copying the URL to the clipboard if neither is available.
 * Returns true if the share succeeded, false otherwise.
 */
export async function share({ title, text, url, dialogTitle }: ShareInput): Promise<boolean> {
  if (isNativeApp()) {
    try {
      const { Share } = await import("@capacitor/share")
      const can = await Share.canShare()
      if (can.value) {
        await Share.share({ title, text, url, dialogTitle })
        return true
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[share] native share failed", err)
    }
  }

  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({ title, text, url })
      return true
    } catch {
      // user cancelled or unsupported — fall through to clipboard
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      /* clipboard unavailable */
    }
  }

  return false
}
