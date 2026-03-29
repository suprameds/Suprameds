import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "in.suprameds.app",
  appName: "Suprameds",
  webDir: "dist/client",
  server: {
    // In dev, point WebView at Vite dev server on the host machine
    // (10.0.2.2 = Android emulator alias for host localhost)
    ...(process.env.CAPACITOR_DEV
      ? { url: "http://10.0.2.2:5176", cleartext: true }
      : {}),
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
