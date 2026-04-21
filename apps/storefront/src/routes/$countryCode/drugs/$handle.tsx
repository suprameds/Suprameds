import { retrieveProduct } from "@/lib/data/products"
import { getRegion } from "@/lib/data/regions"
import { sdk } from "@/lib/utils/sdk"
import DrugInfoPage from "@/pages/drug-info"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/drugs/$handle")({
  loader: async ({ params, context }) => {
    const { countryCode, handle } = params
    const { queryClient } = context

    const region = await queryClient.ensureQueryData({
      queryKey: ["region", countryCode],
      queryFn: () => getRegion({ country_code: countryCode }),
    })

    if (!region || !handle) {
      throw notFound()
    }

    // Fetch Medusa product data (with pricing)
    const product = await queryClient.ensureQueryData({
      queryKey: ["product", handle, region.id],
      queryFn: async () => {
        try {
          return await retrieveProduct({
            handle,
            region_id: region.id,
            fields:
              "*variants, +variants.inventory_quantity, +variants.manage_inventory, +variants.allow_backorder, +variants.calculated_price, *images, *options, *options.values, *collection, *tags",
          })
        } catch {
          throw notFound()
        }
      },
    })

    // Fetch pharma clinical data
    let pharma: { drug_product: any } | null = null
    try {
      pharma = await sdk.client.fetch<{ drug_product: any }>(
        `/store/products/pharma?handle=${encodeURIComponent(handle)}`,
        { method: "GET" }
      )
    } catch {
      // pharma metadata unavailable
    }

    if (pharma?.drug_product) {
      ;(product as any).drug_product = pharma.drug_product
    }

    // Fetch substitute / cheaper alternatives
    let substitutes: any[] = []
    try {
      const subsRes = await sdk.client.fetch<{ substitutes: any[] }>(
        `/store/products/substitutes?product_id=${product.id}`,
        { method: "GET" }
      )
      substitutes = subsRes?.substitutes || []
    } catch {
      // substitutes unavailable
    }

    return {
      countryCode,
      region,
      product,
      substitutes,
    }
  },

  head: ({ loaderData, params }) => {
    const { product, region } = loaderData || {}
    const siteUrl = import.meta.env.VITE_SITE_URL || "https://supracyn.in"
    const countryCode = params?.countryCode || "in"

    if (!product) {
      return {
        meta: [{ title: "Medicine Information | Suprameds" }],
      }
    }

    const drug = (product as any)?.drug_product as any | undefined
    const genericName = drug?.generic_name || ""
    const composition = drug?.composition || ""
    const dosageForm = drug?.dosage_form || ""
    const schedule = drug?.schedule || "OTC"
    const faqs = drug?.metadata?.faqs as { q: string; a: string }[] | undefined

    const canonical = `${siteUrl}/${countryCode}/drugs/${product.handle}`
    const productUrl = `${siteUrl}/${countryCode}/products/${product.handle}`

    // Title: "Generic Name (Brand) - Uses, Side Effects, Dosage | Suprameds"
    const titleParts = [
      genericName || product.title,
      genericName && product.title !== genericName ? `(${product.title})` : "",
      "- Uses, Side Effects, Dosage | Suprameds",
    ]
      .filter(Boolean)
      .join(" ")

    // Description: first 150 chars of indications or a fallback
    const indicationsText = drug?.indications || ""
    const descriptionRaw =
      indicationsText ||
      `Clinical information for ${genericName || product.title}. Uses, side effects, dosage, drug interactions, and storage instructions.`
    const description =
      descriptionRaw.length > 155
        ? descriptionRaw.slice(0, 152) + "..."
        : descriptionRaw

    // ── Schema.org: Drug ──
    const sideEffectsSummary = drug?.side_effects
      ? drug.side_effects.length > 200
        ? drug.side_effects.slice(0, 197) + "..."
        : drug.side_effects
      : undefined

    const drugSchema: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "Drug",
      name: product.title,
      url: canonical,
      description: indicationsText || product.description || "",
    }
    if (genericName) drugSchema.nonProprietaryName = genericName
    if (composition) drugSchema.activeIngredient = composition
    if (dosageForm) drugSchema.dosageForm = dosageForm
    if (sideEffectsSummary) drugSchema.warning = sideEffectsSummary
    if (drug?.metadata?.manufacturer) {
      drugSchema.manufacturer = {
        "@type": "Organization",
        name: drug.metadata.manufacturer,
      }
    }
    // Link to product purchase page
    drugSchema.offers = {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: region?.currency_code?.toUpperCase() || "INR",
      price: product.variants?.[0]?.calculated_price?.calculated_amount
        ? product.variants[0].calculated_price.calculated_amount.toFixed(2)
        : undefined,
      availability:
        product.variants?.[0] &&
        (!product.variants[0].manage_inventory ||
          (product.variants[0].inventory_quantity ?? 0) > 0)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    }

    // ── Schema.org: FAQPage ──
    let faqSchema: Record<string, any> | null = null
    if (faqs && faqs.length > 0) {
      faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      }
    }

    // ── Schema.org: BreadcrumbList ──
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: `${siteUrl}/${countryCode}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Medicines",
          item: `${siteUrl}/${countryCode}/store`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: genericName || product.title,
          item: canonical,
        },
      ],
    }

    const thumbnailUrl = product.images?.[0]?.url || product.thumbnail || ""

    return {
      meta: [
        { title: titleParts },
        { name: "description", content: description },
        { property: "og:title", content: titleParts },
        { property: "og:description", content: description },
        { property: "og:image", content: thumbnailUrl },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "article" },
        { property: "og:site_name", content: "Suprameds" },
        { property: "twitter:card", content: "summary_large_image" },
        { property: "twitter:title", content: titleParts },
        { property: "twitter:description", content: description },
        { name: "twitter:image", content: thumbnailUrl },
        // Medical SEO meta
        ...(schedule === "H" || schedule === "H1"
          ? [{ name: "robots", content: "index, follow, noarchive" }]
          : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(drugSchema),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(breadcrumbSchema),
        },
        ...(faqSchema
          ? [
              {
                type: "application/ld+json",
                children: JSON.stringify(faqSchema),
              },
            ]
          : []),
      ],
    }
  },

  component: DrugInfoPage,
})
