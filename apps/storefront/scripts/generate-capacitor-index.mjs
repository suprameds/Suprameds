/**
 * Post-build script: generates index.html for Capacitor from dist/client/ assets.
 *
 * TanStack Start generates HTML server-side, but Capacitor needs a static index.html.
 * This script scans dist/client/assets/ for the main JS bundle and CSS file,
 * then writes a minimal HTML shell that boots the client app.
 *
 * Usage: node scripts/generate-capacitor-index.mjs
 */
import { readdirSync, writeFileSync } from "fs"
import { join } from "path"

const distDir = join(import.meta.dirname, "..", "dist", "client")
const assetsDir = join(distDir, "assets")

const files = readdirSync(assetsDir)
const mainJs = files.find((f) => f.startsWith("main-") && f.endsWith(".js"))
const mainCss = files.find((f) => f.startsWith("app-") && f.endsWith(".css"))

if (!mainJs) {
  console.error("Could not find main-*.js in dist/client/assets/")
  process.exit(1)
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
  <title>Suprameds</title>
  <link rel="icon" type="image/svg+xml" href="/images/suprameds.svg" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png" />
  <meta name="theme-color" content="#0D1B2A" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="description" content="Suprameds — CDSCO-registered online pharmacy. Pharmacist-dispensed medicines delivered across India." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;1,9..144,400&display=swap" />
  ${mainCss ? `<link rel="stylesheet" href="/assets/${mainCss}" />` : ""}
</head>
<body>
  <div id="__tsr"></div>
  <script type="module" src="/assets/${mainJs}"></script>
</body>
</html>
`

writeFileSync(join(distDir, "index.html"), html)
console.log(`Generated dist/client/index.html (JS: ${mainJs}, CSS: ${mainCss || "none"})`)
