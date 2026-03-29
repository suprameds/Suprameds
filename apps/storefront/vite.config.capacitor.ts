/**
 * Vite config for Capacitor SPA build.
 *
 * Uses tanstackStart() to resolve route imports, but VITE_CAPACITOR=true
 * makes the router disable SSR (defaultSsr: false in router.tsx).
 * Output goes to dist/client/ which Capacitor syncs into the Android APK.
 *
 * Usage:
 *   pnpm build:mobile
 *   # or manually: cross-env VITE_CAPACITOR=true npx vite build --config vite.config.capacitor.ts
 */
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import viteTsConfigPaths from "vite-tsconfig-paths"
import path from "path"

export default defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],

  define: {
    "import.meta.env.VITE_CAPACITOR": JSON.stringify("true"),
  },

  build: {
    sourcemap: false,
  },

  ssr: {
    noExternal: ["@medusajs/js-sdk", "@medusajs/types"],
    optimizeDeps: {
      include: ["@medusajs/js-sdk"],
    },
  },

  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@tanstack/react-query",
      "@tanstack/react-router",
      "@medusajs/js-sdk",
      "@capacitor/core",
    ],
  },

  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router"],
  },
})
