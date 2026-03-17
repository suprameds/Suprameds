import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { PHARMA_MODULE } from "../modules/pharma"
import {
  createCollectionsWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows"

type BrochureProduct = {
  brand_name: string
  composition: string
  dosage_form: "tablet" | "capsule"
  strength: string | null
  schedule: "H" | "H1" | "OTC" | "X"
  therapeutic_class: string
}

const PRODUCTS: BrochureProduct[] = [
  {
    brand_name: "GLIMCYN-M Tab",
    composition: "Glimepiride 1mg + Metformin 500mg (Sustained Release)",
    dosage_form: "tablet",
    strength: "1mg/500mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLIMCYNMET 2 Tab",
    composition: "Glimepiride 2mg + Metformin 500mg (Sustained Release)",
    dosage_form: "tablet",
    strength: "2mg/500mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLIMCYN M1 FORTE Tab",
    composition: "Glimepiride 1mg + Metformin 1000mg",
    dosage_form: "tablet",
    strength: "1mg/1000mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLIMCYN M2 FORTE Tab",
    composition: "Glimepiride 2mg + Metformin 1000mg",
    dosage_form: "tablet",
    strength: "2mg/1000mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLIMCYN MV2 Tab",
    composition: "Glimepiride 2mg + Metformin 500mg + Voglibose 0.2mg",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "BEPRIDE 1 Tab",
    composition: "Glimepiride 1mg",
    dosage_form: "tablet",
    strength: "1mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "BEPRIDE 2 Tab",
    composition: "Glimepiride 2mg",
    dosage_form: "tablet",
    strength: "2mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "MAXFORMIN SR 500 Tab",
    composition: "Metformin 500mg",
    dosage_form: "tablet",
    strength: "500mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "MAXFORMIN SR 1000 Tab",
    composition: "Metformin 1000mg",
    dosage_form: "tablet",
    strength: "1000mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAXABAY 25 Tab",
    composition: "Acarbose 25mg",
    dosage_form: "tablet",
    strength: "25mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAXABAY 50 Tab",
    composition: "Acarbose 50mg",
    dosage_form: "tablet",
    strength: "50mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAXABAY-M 25 Tab",
    composition: "Acarbose 25mg + Metformin Hydrochloride 500mg",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAXABAY-M 50 Tab",
    composition: "Acarbose 50mg + Metformin Hydrochloride 500mg",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAPACYN-5 Tab",
    composition: "Dapagliflozin 5mg",
    dosage_form: "tablet",
    strength: "5mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAPACYN-10 Tab",
    composition: "Dapagliflozin 10mg",
    dosage_form: "tablet",
    strength: "10mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAPADAX-M 5/500 Tab",
    composition: "Dapagliflozin 5mg + Metformin Hydrochloride 500mg",
    dosage_form: "tablet",
    strength: "5mg/500mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAPADAX-M 5/1000 Tab",
    composition: "Dapagliflozin 5mg + Metformin Hydrochloride 1000mg",
    dosage_form: "tablet",
    strength: "5mg/1000mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAPADAX-M 10/500 Tab",
    composition: "Dapagliflozin 10mg + Metformin Hydrochloride 500mg",
    dosage_form: "tablet",
    strength: "10mg/500mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAPADAX-M 10/1000 Tab",
    composition: "Dapagliflozin 10mg + Metformin Hydrochloride 1000mg",
    dosage_form: "tablet",
    strength: "10mg/1000mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAPADAX-TG 10/20 Tab",
    composition: "Dapagliflozin 10mg + Teneligliptin Hydrobromide Hydrate 20mg",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAPADAX-VG 10/100 Tab",
    composition: "Dapagliflozin 10mg + Vildagliptin 100mg (SR)",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAPADAX-VGM 10/100/500 Tab",
    composition: "Dapagliflozin 10mg + Vildagliptin 100mg + Metformin Hydrochloride 500mg",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "DAPADAX-VGM 10/100/1000 Tab",
    composition: "Dapagliflozin 10mg + Vildagliptin 100mg + Metformin Hydrochloride 1000mg",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "FORDAY 850 SR Tab",
    composition: "Metformin 850mg SR",
    dosage_form: "tablet",
    strength: "850mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GBMIDE PM Tab",
    composition: "Pioglitazone 15mg + Metformin HCl 500mg + Glibenclamide 5mg",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLICIA 30 MR Tab",
    composition: "Gliclazide 30mg MR",
    dosage_form: "tablet",
    strength: "30mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLICIA 60 MR Tab",
    composition: "Gliclazide 60mg MR",
    dosage_form: "tablet",
    strength: "60mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLICIA 40 Tab",
    composition: "Gliclazide 40mg",
    dosage_form: "tablet",
    strength: "40mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLICIA 80 Tab",
    composition: "Gliclazide 80mg",
    dosage_form: "tablet",
    strength: "80mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLICIA M 30 SR Tab",
    composition: "Gliclazide 30mg + Metformin 500mg SR",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLICIA M 40 Tab",
    composition: "Gliclazide 40mg + Metformin 500mg",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLICIA M 60 SR Tab",
    composition: "Gliclazide 60mg + Metformin 500mg SR",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLICIA M 80 Tab",
    composition: "Gliclazide 80mg + Metformin 500mg",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLICIA TOTAL - 60 Tab",
    composition: "Gliclazide 60mg + Metformin 500mg SR + Pioglitazone 15mg",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLIVO M 0.2 Tab",
    composition: "Gliclazide 80mg + Metformin 500mg + Voglibose 0.2mg",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLIVO M 0.3 Tab",
    composition: "Gliclazide 80mg + Metformin 500mg + Voglibose 0.3mg",
    dosage_form: "tablet",
    strength: null,
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLIDAX 3 Tab",
    composition: "Glimepiride 3mg",
    dosage_form: "tablet",
    strength: "3mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  {
    brand_name: "GLIDAX 4 Tab",
    composition: "Glimepiride 4mg",
    dosage_form: "tablet",
    strength: "4mg",
    schedule: "H",
    therapeutic_class: "antidiabetic",
  },
  // --- Cardiology (from brochure pages 4-7) ---
  {
    brand_name: "SUPRATEL-20",
    composition: "Telmisartan 20mg",
    dosage_form: "tablet",
    strength: "20mg",
    schedule: "H",
    therapeutic_class: "cardiology",
  },
  {
    brand_name: "SUPRATEL-40",
    composition: "Telmisartan 40mg",
    dosage_form: "tablet",
    strength: "40mg",
    schedule: "H",
    therapeutic_class: "cardiology",
  },
]

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function makeSku(brandName: string): string {
  return `SUPRACYN-${brandName.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(
    0,
    48
  )
}

function inferGenericName(composition: string): string {
  const first = composition.split("+")[0]?.trim()
  return (first || "Unknown").replace(/\s+\(.+\)$/, "")
}

export default async function migration_17032026_supracyn_products({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // Resolve default sales channel (used for product visibility).
  const salesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  )
  const [defaultSalesChannel] =
    await salesChannelModuleService.listSalesChannels({
      name: "Default Sales Channel",
    })
  if (!defaultSalesChannel?.id) {
    logger.warn(
      "[seed] Default Sales Channel not found; run the base seed first. Skipping."
    )
    return
  }

  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  )
  const [shippingProfile] = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfile?.id) {
    logger.warn(
      "[seed] No default shipping profile found; skipping Supracyn product seed."
    )
    return
  }

  const handles = PRODUCTS.map((p) => `supracyn-${slugify(p.brand_name)}`)

  // If we already seeded, delete and re-seed (so fields like sales channels / collections get applied).
  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: {
      handle: handles,
    },
  })
  if (existing?.length) {
    logger.info(`[seed] Deleting ${existing.length} existing Supracyn products...`)
    await deleteProductsWorkflow(container).run({
      input: { ids: existing.map((p: any) => p.id) },
    })
  }

  // Create (or reuse) collections.
  const collectionTitleByThera: Record<string, string> = {
    antidiabetic: "Antidiabetic",
    cardiology: "Cardiology",
  }

  const wantedCollections = Array.from(
    new Set(PRODUCTS.map((p) => collectionTitleByThera[p.therapeutic_class] ?? "General"))
  )

  // Fetch any existing collections first (avoid duplicates).
  const { data: existingCollections } = await query.graph({
    entity: "product_collection",
    fields: ["id", "title", "handle"],
    filters: { title: wantedCollections },
  })

  const missingCollectionTitles = wantedCollections.filter(
    (t) => !(existingCollections as any[])?.some((c) => c.title === t)
  )

  const createdCollections =
    missingCollectionTitles.length > 0
      ? (
          await createCollectionsWorkflow(container).run({
            input: {
              collections: missingCollectionTitles.map((title) => ({
                title,
                handle: slugify(title),
                metadata: { source: "supracyn-brochure-2025" },
              })),
            },
          })
        ).result
      : []

  const collections = [...(existingCollections as any[]), ...(createdCollections as any[])]
  const collectionIdByTitle = new Map<string, string>(
    collections.map((c) => [c.title, c.id])
  )

  const { result: created } = await createProductsWorkflow(container).run({
    input: {
      products: PRODUCTS.map((p) => {
        const handle = `supracyn-${slugify(p.brand_name)}`
        const collectionTitle =
          collectionTitleByThera[p.therapeutic_class] ?? "General"
        return {
          title: p.brand_name,
          handle,
          description: p.composition,
          subtitle: p.therapeutic_class,
          status: "published",
          sales_channels: [{ id: defaultSalesChannel.id }],
          collection_id: collectionIdByTitle.get(collectionTitle),
          options: [
            {
              title: "Pack",
              values: ["default"],
            },
          ],
          variants: [
            {
              title: p.brand_name,
              sku: makeSku(p.brand_name),
              options: {
                Pack: "default",
              },
              prices: [
                {
                  currency_code: "inr",
                  amount: 1,
                },
              ],
              manage_inventory: false,
            },
          ],
          shipping_profile_id: shippingProfile.id,
          metadata: {
            source: "supracyn-brochure-2025",
          },
        }
      }),
    },
  })

  const pharmaService = container.resolve(PHARMA_MODULE)

  await pharmaService.createDrugProducts(
    created.map((product) => {
      const match = PRODUCTS.find((p) => p.brand_name === product.title)
      if (!match) {
        throw new Error(
          `[seed] Missing brochure metadata for created product "${product.title}".`
        )
      }

      return {
        product_id: product.id,
        schedule: match.schedule,
        generic_name: inferGenericName(match.composition),
        therapeutic_class: match.therapeutic_class,
        dosage_form: match.dosage_form,
        strength: match.strength,
        composition: match.composition,
        unit_type: "strip" as const,
        gst_rate: 12,
        metadata: {
          source: "supracyn-brochure-2025",
        },
      }
    })
  )

  logger.info(`[seed] Seeded ${created.length} Supracyn products.`)
}

