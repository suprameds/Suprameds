/**
 * Separate Vite config for building the PWA service worker.
 *
 * vite-plugin-pwa is incompatible with TanStack Start's multi-environment
 * SSR build (the SW file is silently skipped). This config runs as a
 * lightweight SPA build that ONLY generates sw.js + manifest.webmanifest
 * into dist/client/, then the main TanStack Start build runs normally.
 *
 * Build order: vite build --config vite.sw.config.ts → vite build
 */
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    outDir: "dist/client",
    emptyOutDir: false,
    rollupOptions: {
      input: "public/offline.html",
    },
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      outDir: "dist/client",
      includeAssets: [
        "favicon.ico",
        "images/suprameds.svg",
        "icons/apple-touch-icon-180x180.png",
      ],
      manifest: {
        name: "Suprameds — Your Trusted Online Pharmacy",
        short_name: "Suprameds",
        description:
          "Licensed Indian online pharmacy. Order genuine medicines with prescription verification, batch tracking, and doorstep delivery.",
        theme_color: "#1E2D5A",
        background_color: "#FAFAF8",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/in",
        scope: "/",
        categories: ["health", "medical", "shopping"],
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globDirectory: "dist/client",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/store\/(regions|product-categories|products)\b/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "medusa-store-api",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/admin/, /^\/auth/],
      },
    }),
  ],
});
