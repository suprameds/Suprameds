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
      launchShowDuration: 0,
      backgroundColor: "#0D1B2A",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#0D1B2A",
    },
  },
  android: {
    allowMixedContent: false,
    useLegacyBridge: false,
  },
}

export default config
