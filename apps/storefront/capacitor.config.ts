import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "in.supracyn.app",
  appName: "Supracyn",
  webDir: "dist/client",
  server: {
    // Load the live hosted site — SSR always fresh.
    // Native Capacitor plugins (camera, status bar, push) still work on top.
    url: "https://supracyn.in",
    androidScheme: "https",
    // Falls back to the bundled offline.html when the remote URL is unreachable.
    // Lives at android/app/src/main/assets/public/offline.html.
    errorPath: "offline.html",
  },
  plugins: {
    SplashScreen: {
      // Show splash until JS signals ready (initCapacitorPlugins() calls SplashScreen.hide()).
      // Fade out over 300ms instead of abrupt cut.
      launchAutoHide: false,
      launchShowDuration: 0,
      launchFadeOutDuration: 300,
      backgroundColor: "#0D1B2A",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      // Android 15 enforces edge-to-edge; WebView draws under system bars.
      // MainActivity wires WindowInsetsCompat to pad the WebView so content
      // doesn't clip behind the status/nav bars.
      style: "LIGHT",
      backgroundColor: "#0D1B2A",
      overlaysWebView: true,
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: false,
    useLegacyBridge: false,
    // Default; explicit for clarity — release builds auto-disable via BuildConfig.DEBUG.
    webContentsDebuggingEnabled: false,
  },
}

export default config
