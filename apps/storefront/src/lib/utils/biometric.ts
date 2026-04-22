import { isNativeApp } from "@/lib/utils/capacitor"

const ENABLED_KEY = "suprameds_biometric_enabled"
const UNLOCKED_SESSION_KEY = "suprameds_biometric_unlocked"

export function isBiometricEnabled(): boolean {
  if (typeof localStorage === "undefined") return false
  return localStorage.getItem(ENABLED_KEY) === "1"
}

export function setBiometricEnabled(enabled: boolean) {
  if (typeof localStorage === "undefined") return
  if (enabled) {
    localStorage.setItem(ENABLED_KEY, "1")
  } else {
    localStorage.removeItem(ENABLED_KEY)
    sessionStorage.removeItem(UNLOCKED_SESSION_KEY)
  }
}

export function isUnlockedThisSession(): boolean {
  if (typeof sessionStorage === "undefined") return true
  return sessionStorage.getItem(UNLOCKED_SESSION_KEY) === "1"
}

export function markUnlocked() {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.setItem(UNLOCKED_SESSION_KEY, "1")
}

/** Check whether biometrics are available + enrolled on the device. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth")
    const info = await BiometricAuth.checkBiometry()
    return info.isAvailable
  } catch {
    return false
  }
}

/**
 * Prompt the user for biometric auth. Returns true if authentication
 * succeeded, false if the user cancelled or biometrics are unavailable.
 */
export async function authenticateBiometric(reason = "Unlock Suprameds"): Promise<boolean> {
  if (!isNativeApp()) return true
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth")
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      allowDeviceCredential: true,
      iosFallbackTitle: "Use passcode",
      androidTitle: "Suprameds",
      androidSubtitle: reason,
      androidConfirmationRequired: false,
    })
    markUnlocked()
    return true
  } catch {
    return false
  }
}
