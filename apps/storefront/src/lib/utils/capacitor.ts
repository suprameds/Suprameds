/**
 * Capacitor native platform detection.
 * Returns true when the app is running inside the Android/iOS Capacitor shell,
 * false when running as a normal website in a browser.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false
  try {
    // Capacitor injects window.Capacitor on native platforms
    const cap = (window as any).Capacitor
    return cap?.isNativePlatform?.() === true
  } catch {
    return false
  }
}
