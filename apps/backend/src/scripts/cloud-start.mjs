/**
 * Cloud Startup Script — Production
 *
 * Runs automatically on every deploy via the Dockerfile CMD.
 * Handles DB migration, seeding, and server boot in the correct order.
 *
 * Medusa v2 production runs from .medusa/server/ (the compiled output).
 * This script cds into ./server/ then runs medusa commands there.
 *
 * Environment variables:
 *   SKIP_PRODUCT_SEED=true — Skip product/batch seeding (use on production after initial setup)
 */
import { execSync } from "child_process"
import { existsSync } from "fs"
import { resolve } from "path"

// In Docker, the compiled server is always at /app/server/.
// Railway's startCommand runs from /app/ as cwd, but the script may live
// at /app/cloud-start.mjs OR /app/src/scripts/cloud-start.mjs (compat copy).
// Use process.cwd() to resolve /app/server/ regardless of script location.
const serverDir = resolve(process.cwd(), "server")

if (!existsSync(serverDir)) {
  console.error(`ERROR: Compiled server directory not found at ${serverDir}`)
  console.error("Did you run 'medusa build' and copy .medusa/server/ to ./server/?")
  process.exit(1)
}

function run(cmd, label) {
  console.log(`\n▶ ${label}`)
  console.log(`  $ ${cmd}`)
  console.log(`  (cwd: ${serverDir})\n`)
  try {
    execSync(cmd, { stdio: "inherit", env: process.env, cwd: serverDir })
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
console.log(`  SKIP_PRODUCT_SEED=${process.env.SKIP_PRODUCT_SEED || "false"}`)
console.log(`  SERVER_DIR=${serverDir}`)
console.log("")

// Step 1: Run MikroORM schema migrations (creates/updates tables)
run("npx medusa db:migrate", "Database schema migration")

// Step 2: Run data seed scripts (idempotent — safe to re-run)
// In the compiled output, ./src/scripts/run-migrations.ts → ./src/scripts/run-migrations.js
run("npx medusa exec ./src/scripts/run-migrations.js", "Data seed & migration scripts")

// Step 3: Start the Medusa server
console.log("\n▶ Starting Medusa server...\n")
try {
  execSync("npx medusa start", { stdio: "inherit", env: process.env, cwd: serverDir })
} catch (err) {
  process.exit(err.status || 1)
}
