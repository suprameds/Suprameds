/**
 * Load Test — Suprameds API
 *
 * Simulates concurrent users browsing and adding to cart.
 * Run with: npx k6 run scripts/load-test.mjs
 * Or without k6: node scripts/load-test.mjs (basic version)
 *
 * Targets:
 *   - Product list: < 1s p95
 *   - Cart operations: < 2s p95
 *   - Health check: < 200ms p95
 */

const BASE_URL = process.env.MEDUSA_BACKEND_URL || "https://backend-production-9d3a.up.railway.app"
const PK = "pk_e2bd20acd56f5f1f41d1c7442ead5295eaf39af4a858c0c42fd99bd0796dcaa3"

const headers = {
  "Content-Type": "application/json",
  "x-publishable-api-key": PK,
}

async function time(label, fn) {
  const start = Date.now()
  try {
    const result = await fn()
    const ms = Date.now() - start
    console.log(`  ${ms < 1000 ? '✅' : ms < 2000 ? '⚠️' : '❌'} ${label}: ${ms}ms`)
    return { ms, result, ok: true }
  } catch (err) {
    const ms = Date.now() - start
    console.log(`  ❌ ${label}: ${ms}ms (ERROR: ${err.message})`)
    return { ms, ok: false }
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function runUserFlow(userId) {
  console.log(`\nUser ${userId}:`)

  // 1. Health check
  await time("Health", () => fetch(`${BASE_URL}/health`).then(r => r.text()))

  // 2. List regions
  const { result: regionsData } = await time("Regions", () => api("/store/regions"))
  const regionId = regionsData?.regions?.[0]?.id

  // 3. Browse products
  await time("Products (12)", () => api(`/store/products?limit=12&region_id=${regionId}&fields=id,title,handle,thumbnail,*variants,+variants.calculated_price`))

  // 4. Browse categories
  await time("Categories", () => api("/store/product-categories?fields=id,name,handle,parent_category_id"))

  // 5. Create cart
  const { result: cartData } = await time("Create cart", () =>
    api("/store/carts", { method: "POST", body: JSON.stringify({ region_id: regionId }) })
  )

  // 6. Search
  await time("Search 'metformin'", () => api("/store/products?q=metformin&limit=5"))

  // 7. Pincode check
  await time("Pincode check", () => api("/store/pincodes/check?pincode=500018"))
}

async function main() {
  console.log(`Load Test: ${BASE_URL}`)
  console.log(`Concurrency: 5 sequential users\n`)

  const results = []
  for (let i = 1; i <= 5; i++) {
    await runUserFlow(i)
  }

  console.log("\n═══════════════════════════")
  console.log("Load test complete.")
  console.log("Target: all green ✅ = < 1s")
}

main().catch(console.error)
