/**
 * Cloud Startup Script
 *
 * Runs automatically on every deploy via `npm start`.
 * Handles DB migration, seeding, and server boot in the correct order.
 *
 * Environment variables:
 *   FRESH_DB=true         — Drop all tables first (full reset). Remove after first deploy!
 *   SKIP_PRODUCT_SEED=true — Skip product/batch seeding (use on production after initial setup)
 */
import { execSync } from "child_process"

function run(cmd, label) {
  console.log(`\n▶ ${label}`)
  console.log(`  $ ${cmd}\n`)
  try {
    execSync(cmd, { stdio: "inherit", env: process.env })
    console.log(`✓ ${label} — done\n`)
  } catch (err) {
    console.error(`✗ ${label} — failed (exit code ${err.status})`)
    process.exit(err.status || 1)
  }
}

console.log("╔══════════════════════════════════════════════════╗")
console.log("║       SUPRAMEDS — Cloud Startup Sequence        ║")
console.log("╚══════════════════════════════════════════════════╝")
console.log("")
console.log(`  FRESH_DB=${process.env.FRESH_DB || "false"}`)
console.log(`  SKIP_PRODUCT_SEED=${process.env.SKIP_PRODUCT_SEED || "false"}`)
console.log("")

// Step 1: Optional full DB reset
if (process.env.FRESH_DB === "true") {
  console.log("⚠  FRESH_DB=true — wiping database before migration!")
  run("npx medusa exec ./src/scripts/db-reset.ts", "Database reset (FRESH_DB)")
}

// Step 2: Run MikroORM schema migrations (creates/updates tables)
run("npx medusa db:migrate", "Database schema migration")

// Step 3: Run data seed scripts (idempotent — safe to re-run)
run("npx medusa exec ./src/scripts/run-migrations.ts", "Data seed & migration scripts")

// Step 4: Start the Medusa server
console.log("\n▶ Starting Medusa server...\n")
try {
  execSync("npx medusa start", { stdio: "inherit", env: process.env })
} catch (err) {
  process.exit(err.status || 1)
}
