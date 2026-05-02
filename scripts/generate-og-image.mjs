import { chromium } from "@playwright/test"
import { fileURLToPath } from "url"
import path from "path"
import fs from "fs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, "../apps/storefront/public/og-default.png")

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px;
    height: 630px;
    background: #1E2D5A;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    position: relative;
  }
  .bg-circle {
    position: absolute;
    border-radius: 50%;
    opacity: 0.07;
    background: white;
  }
  .bg-circle-1 { width: 600px; height: 600px; top: -200px; right: -100px; }
  .bg-circle-2 { width: 400px; height: 400px; bottom: -150px; left: -80px; }
  .green-bar {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 8px;
    background: #27AE60;
  }
  .content {
    padding: 0 80px;
    position: relative;
    z-index: 1;
  }
  .badge {
    display: inline-block;
    background: #27AE60;
    color: white;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 6px 16px;
    border-radius: 4px;
    margin-bottom: 28px;
  }
  .headline {
    color: white;
    font-size: 64px;
    font-weight: 800;
    line-height: 1.1;
    margin-bottom: 20px;
    letter-spacing: -1px;
  }
  .headline span { color: #27AE60; }
  .sub {
    color: rgba(255,255,255,0.7);
    font-size: 26px;
    font-weight: 400;
    line-height: 1.4;
    max-width: 700px;
    margin-bottom: 36px;
  }
  .pills {
    display: flex;
    gap: 12px;
  }
  .pill {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    color: rgba(255,255,255,0.85);
    font-size: 16px;
    padding: 8px 20px;
    border-radius: 100px;
  }
  .domain {
    position: absolute;
    bottom: 36px;
    right: 64px;
    color: rgba(255,255,255,0.4);
    font-size: 20px;
    font-weight: 500;
    z-index: 1;
  }
</style>
</head>
<body>
  <div class="bg-circle bg-circle-1"></div>
  <div class="bg-circle bg-circle-2"></div>
  <div class="green-bar"></div>
  <div class="content">
    <div class="badge">Licensed Online Pharmacy · India</div>
    <div class="headline">Generic Medicines<br>at <span>50–80% Off</span> MRP</div>
    <div class="sub">Pharmacist-dispensed. CDSCO-registered.<br>Speed Post delivery across India.</div>
    <div class="pills">
      <div class="pill">✓ DL: TS/HYD/2021-82149</div>
      <div class="pill">✓ 750+ Medicines</div>
      <div class="pill">✓ Schedule H/H1 Rx</div>
    </div>
  </div>
  <div class="domain">supracyn.in</div>
</body>
</html>`

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 1200, height: 630 })
await page.setContent(html, { waitUntil: "networkidle" })
await page.screenshot({ path: outPath, type: "png" })
await browser.close()

console.log(`✓ og-default.png written to ${outPath}`)
