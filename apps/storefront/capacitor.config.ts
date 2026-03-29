import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "in.suprameds.app",
  appName: "Suprameds",
  webDir: "dist/client",
  server: {
    // Load the live hosted site — SSR works, always up-to-date content.
    // Native Capacitor plugins (camera, status bar, push) still work on top.
    url: "https://store.supracynpharma.com",
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#1E2D5A",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1E2D5A",
    },
  },
  android: {
    allowMixedContent: false,
    useLegacyBridge: false,
  },
}

export default config
