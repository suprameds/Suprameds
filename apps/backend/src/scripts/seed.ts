/**
 * Medusa Cloud calls this after `db:migrate` on fresh deploys.
 * Delegates to the unified migration runner so the database is
 * fully seeded (regions, shipping, payments, catalog, FTS).
 */
import { MedusaContainer } from "@medusajs/framework"
import runMigrations from "./run-migrations"

export default async function seedDemoData({
  container,
}: {
  container: MedusaContainer
}) {
  await runMigrations({ container })
}
