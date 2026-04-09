/**
 * 006-update-categories.ts
 *
 * Adds new product categories and collections, deactivates legacy ones.
 *
 * New categories under "Medicines": Thyroid, Urology, Pain Management
 * New category under "Mother & Baby": Baby Care
 * Deactivated: Cardiac Care, Respiratory, Dermatology, Vitamins & Supplements
 * New collections: Thyroid, Urology, Pain Management, Baby Care
 *
 * Idempotent — safe to re-run.
 */

import { MedusaContainer } from "@medusajs/framework"
import { ModuleRegistrationName } from "@medusajs/framework/utils"
import { createLogger } from "../lib/logger"

const logger = createLogger("migration:006-update-categories")

export default async function updateCategories({
  container,
}: {
  container: MedusaContainer
}) {
  const productService = container.resolve(
    ModuleRegistrationName.PRODUCT
  ) as any

  // ── Load existing categories ──────────────────────────────────────────
  const existingCategories = await productService.listProductCategories(
    {},
    { take: 200 }
  )
  const byHandle = new Map<string, any>(
    existingCategories.map((c: any) => [c.handle, c])
  )

  // Helper: create category if missing
  async function ensureCat(data: {
    name: string
    handle: string
    parent_category_id?: string
  }) {
    if (byHandle.has(data.handle)) {
      logger.info(`  Category '${data.name}' exists, skipping.`)
      return byHandle.get(data.handle)
    }
    try {
      const created = await productService.createProductCategories({
        ...data,
        is_active: true,
        is_internal: false,
      })
      byHandle.set(data.handle, created)
      logger.info(`  Created category: ${data.name}`)
      return created
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        logger.info(`  Category '${data.name}' already exists.`)
        const [found] = await productService.listProductCategories(
          { handle: data.handle },
          { take: 1 }
        )
        if (found) byHandle.set(data.handle, found)
        return found
      }
      throw err
    }
  }

  // ── 1. New subcategories under "Medicines" ────────────────────────────
  const medicines = byHandle.get("medicines")
  if (!medicines?.id) {
    logger.info("WARNING: 'Medicines' parent category not found. Run 001-infra-seed first.")
    return
  }

  const NEW_MEDICINE_SUBS = [
    { name: "Thyroid", handle: "thyroid" },
    { name: "Urology", handle: "urology" },
    { name: "Pain Management", handle: "pain-management" },
  ]

  for (const sub of NEW_MEDICINE_SUBS) {
    await ensureCat({ ...sub, parent_category_id: medicines.id })
  }

  // ── 2. Baby Care under "Mother & Baby" ────────────────────────────────
  const motherBaby = byHandle.get("mother-baby")
  if (motherBaby?.id) {
    await ensureCat({ name: "Baby Care", handle: "baby-care", parent_category_id: motherBaby.id })
  } else {
    logger.info("WARNING: 'Mother & Baby' parent category not found.")
  }

  // ── 3. Deactivate legacy categories ───────────────────────────────────
  const INACTIVE = ["cardiac-care", "respiratory", "dermatology", "vitamins-supplements"]
  for (const handle of INACTIVE) {
    const cat = byHandle.get(handle)
    if (cat?.id && cat.is_active !== false) {
      await productService.updateProductCategories(cat.id, { is_active: false })
      logger.info(`  Deactivated: ${handle}`)
    }
  }

  // ── 4. New collections ────────────────────────────────────────────────
  const existingCollections = await productService.listProductCollections(
    {},
    { take: 100 }
  )
  const colByHandle = new Map(
    existingCollections.map((c: any) => [c.handle, c])
  )

  const NEW_COLLECTIONS = [
    { title: "Thyroid", handle: "thyroid" },
    { title: "Urology", handle: "urology" },
    { title: "Pain Management", handle: "pain-management" },
    { title: "Baby Care", handle: "baby-care" },
  ]

  for (const col of NEW_COLLECTIONS) {
    if (!colByHandle.has(col.handle)) {
      try {
        await productService.createProductCollections(col)
        logger.info(`  Created collection: ${col.title}`)
      } catch (err: any) {
        if (err.message?.includes("already exists")) {
          logger.info(`  Collection '${col.title}' already exists.`)
        } else {
          throw err
        }
      }
    } else {
      logger.info(`  Collection '${col.title}' exists, skipping.`)
    }
  }

  logger.info("Category & collection update complete.")
}
