import { sentryVitePlugin } from "@sentry/vite-plugin";
import medusaAiTags from "@medusajs-ai/tags";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import Terminal from "vite-plugin-terminal";
import viteTsConfigPaths from "vite-tsconfig-paths";

// Function-form manualChunks routes resolved module IDs into long-cacheable
// vendor chunks. Skips externalized modules (those whose ID isn't a real
// node_modules path) so the SSR build, which externalizes node_modules,
// doesn't fail with "react cannot be included in manualChunks".
//
// Kept conservative: React + TanStack are NOT chunked because they have
// intricate cross-module references that confused Rollup's export tracer
// during testing (null deref in getVariableForExportName). The four
// libraries below are independent and chunk cleanly.
const vendorChunks = (id: string): string | undefined => {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("@sentry")) return "vendor-sentry";
  if (id.includes("/firebase/")) return "vendor-firebase";
  if (id.includes("@medusajs/js-sdk") || id.includes("@medusajs/icons")) {
    return "vendor-medusa";
  }
  if (id.includes("@radix-ui")) return "vendor-radix";
  return undefined;
};

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    plugins: [
      Terminal({ console: "terminal", output: ["terminal"] }),
      viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
      tailwindcss(),

      ...(isDev
        ? [
            medusaAiTags({
              enabled: true,
              includeRuntime: true,
            }),
          ]
        : []),

      tanstackStart(),
      viteReact(),

      // Sentry source maps — only during production builds when auth token is set
      ...(!isDev && process.env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              org: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT || "suprameds-storefront",
              authToken: process.env.SENTRY_AUTH_TOKEN,
              sourcemaps: {
                filesToDeleteAfterUpload: ["./dist/**/*.map"],
              },
            }),
          ]
        : []),
    ],

    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          // Split heavy, rarely-changed deps into long-cacheable vendor chunks
          // so they survive deploys without forcing a re-download. Without
          // this, a 1MB+ main.js carried Sentry + Firebase + Medusa SDK +
          // Radix on every release. The function form skips externalized
          // modules (ids without node_modules path) so the SSR build is
          // unaffected.
          manualChunks: vendorChunks,
        },
      },
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
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/react-router",
        "@medusajs/js-sdk",
        "@medusajs/icons",
        "lodash-es",
      ],
      exclude: ["@medusajs-ai/tags"],
    },

    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-router"],
    },

    server: {
      port: 5173,
    },
  };
});
