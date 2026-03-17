import ProductActions from "@/components/product-actions"
import { ImageGallery } from "@/components/ui/image-gallery"
import { useLoaderData } from "@tanstack/react-router"

type DrugProduct = {
  schedule?: "OTC" | "H" | "H1" | "X"
  generic_name?: string | null
  composition?: string | null
  dosage_form?: string | null
  strength?: string | null
  gst_rate?: number | null
}

function scheduleCopy(schedule: DrugProduct["schedule"]) {
  if (schedule === "H" || schedule === "H1") return { label: "Prescription required", tone: "rx" as const }
  if (schedule === "X") return { label: "Not for online sale", tone: "blocked" as const }
  return { label: "OTC", tone: "otc" as const }
}

/**
 * Product Page Pattern
 *
 * Demonstrates:
 * - useLoaderData for SSR-loaded product and region
 * - Product data structure (images, variants, options)
 * - ProductActions for variant selection + add to cart
 * - ImageGallery for product images
 *
 * Key interactions:
 * - Variant selection updates price display
 * - Add to cart with optimistic updates
 * - Stock checking per variant
 */
const ProductDetails = () => {
  const { product, region } = useLoaderData({
    from: "/$countryCode/products/$handle",
  })

  const drug = (product as any)?.drug_product as DrugProduct | undefined
  const sched = scheduleCopy(drug?.schedule)

  return (
    <div className="content-container py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Image gallery */}
        <div>
          <ImageGallery images={product.images || []} />
        </div>

        {/* Right: Product info + variant selection */}
        <div>
          <h1 className="text-2xl font-medium mb-2">{product.title}</h1>
          {drug?.schedule && (
            <div
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border mb-3"
              style={{
                borderColor:
                  sched.tone === "rx"
                    ? "#F39C12"
                    : sched.tone === "blocked"
                      ? "#EF4444"
                      : "#E5E7EB",
                background:
                  sched.tone === "rx"
                    ? "rgba(243,156,18,0.10)"
                    : sched.tone === "blocked"
                      ? "rgba(239,68,68,0.10)"
                      : "#fff",
                color:
                  sched.tone === "rx"
                    ? "#A16207"
                    : sched.tone === "blocked"
                      ? "#B91C1C"
                      : "#52525B",
              }}
            >
              {sched.label}
            </div>
          )}
          {product.description && (
            <p className="text-secondary-text mb-6">{product.description}</p>
          )}
          <ProductActions product={product} region={region} />

          {drug && (
            <div className="mt-8 border-t pt-6">
              <h2 className="text-base font-semibold mb-3">Medicine details</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {drug.generic_name && (
                  <>
                    <dt className="text-zinc-500">Generic name</dt>
                    <dd className="text-zinc-900">{drug.generic_name}</dd>
                  </>
                )}
                {drug.dosage_form && (
                  <>
                    <dt className="text-zinc-500">Dosage form</dt>
                    <dd className="text-zinc-900">{drug.dosage_form}</dd>
                  </>
                )}
                {drug.strength && (
                  <>
                    <dt className="text-zinc-500">Strength</dt>
                    <dd className="text-zinc-900">{drug.strength}</dd>
                  </>
                )}
                {typeof drug.gst_rate === "number" && (
                  <>
                    <dt className="text-zinc-500">GST</dt>
                    <dd className="text-zinc-900">{drug.gst_rate}%</dd>
                  </>
                )}
              </dl>

              {drug.composition && (
                <div className="mt-4">
                  <div className="text-sm text-zinc-500 mb-1">Composition</div>
                  <div className="text-sm text-zinc-900">{drug.composition}</div>
                </div>
              )}

              {(drug.schedule === "H" || drug.schedule === "H1") && (
                <div
                  className="mt-4 rounded-md border p-3 text-sm"
                  style={{ borderColor: "#F39C12", background: "rgba(243,156,18,0.08)", color: "#0D1B2A" }}
                >
                  This medicine requires a valid prescription. You can upload it during checkout.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductDetails
