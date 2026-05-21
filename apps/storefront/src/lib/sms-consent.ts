/**
 * Android SMS User Consent API — JS-side wrapper for the native plugin in
 * `apps/storefront/android/app/src/main/java/in/supracyn/app/SmsConsentPlugin.java`.
 *
 * What this does:
 *   - On Android native: asks the OS to watch for any SMS containing a 4-10 digit
 *     code over the next 5 minutes. When one arrives, Android shows a one-tap
 *     consent dialog quoting the message. On Allow, the callback receives the
 *     extracted code and the caller can auto-submit the OTP form.
 *   - On iOS and web: no-op. iOS uses the keyboard's QuickType suggestion
 *     (already wired via `autoComplete="one-time-code"` on the input); web
 *     PWA on Android relies on Gboard's SMS-suggestion chip.
 *
 * Why User Consent (not SMS Retriever):
 *   - Retriever requires the SMS body to end with an 11-char app hash derived
 *     from our keystore. That hash would need to be added to a NEW DLT-approved
 *     template, a multi-day telecom-ops change. User Consent works with any
 *     SMS containing a code — including our existing DLT-approved template.
 *   - Both APIs avoid the dreaded READ_SMS permission, which Google Play
 *     restricts to a small allowlist of app categories.
 *
 * Failure modes are all silent — the OTP form remains usable; the user can
 * always type the code manually. Specifically: plugin missing in an older
 * build, Play Services unavailable, user denies consent, 5-min window
 * elapses without an SMS, dual-SIM routing weirdness.
 */
import { registerPlugin, Capacitor, type PluginListenerHandle } from "@capacitor/core"

interface SmsReceivedPayload {
  code?: string
  message?: string
}

interface SmsConsentPluginInterface {
  startListening(): Promise<{ listening: boolean }>
  stopListening(): Promise<void>
  addListener(
    event: "smsReceived",
    cb: (data: SmsReceivedPayload) => void
  ): Promise<PluginListenerHandle>
  addListener(
    event: "denied" | "timeout",
    cb: () => void
  ): Promise<PluginListenerHandle>
}

const SmsConsent = registerPlugin<SmsConsentPluginInterface>("SmsConsent")

export interface SmsConsentHandle {
  /** Stop the SMS listener and remove all event handlers. Safe to call multiple times. */
  cancel: () => void
}

/**
 * Start the Android SMS User Consent flow. `onCode` fires once the user
 * grants consent on the system dialog; the caller typically calls
 * `setOtp(code)` + auto-submits the form.
 *
 * Returns a handle whose `cancel()` cleans up the listener — call it from
 * a `useEffect` cleanup so an unmount or a tab switch doesn't leak the
 * BroadcastReceiver on the native side.
 */
export async function startSmsConsent(
  onCode: (code: string) => void
): Promise<SmsConsentHandle> {
  // Capacitor.getPlatform() returns "web" outside the native shell — covers
  // dev server, Vitest, SSR, and iOS (which doesn't need this; iOS QuickType
  // handles autofill via the input attribute).
  if (Capacitor.getPlatform() !== "android") {
    return { cancel: () => {} }
  }

  let received: PluginListenerHandle | null = null
  let denied: PluginListenerHandle | null = null
  let timeout: PluginListenerHandle | null = null
  let cleanedUp = false

  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    // Best-effort — never let a cleanup throw out of the consumer's useEffect.
    void received?.remove().catch(() => {})
    void denied?.remove().catch(() => {})
    void timeout?.remove().catch(() => {})
    void SmsConsent.stopListening().catch(() => {})
  }

  try {
    received = await SmsConsent.addListener("smsReceived", ({ code }) => {
      if (code) onCode(code)
      cleanup()
    })
    denied = await SmsConsent.addListener("denied", cleanup)
    timeout = await SmsConsent.addListener("timeout", cleanup)
    await SmsConsent.startListening()
  } catch {
    // Plugin not bundled in an older build, or Play Services unavailable.
    // The form remains usable — user can type the code manually.
    cleanup()
  }

  return { cancel: cleanup }
}
