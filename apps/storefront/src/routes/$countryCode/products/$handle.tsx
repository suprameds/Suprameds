import { listProducts, retrieveProduct } from "@/lib/data/products";
import { getRegion } from "@/lib/data/regions";
import { queryKeys } from "@/lib/utils/query-keys";
import { sdk } from "@/lib/utils/sdk";
import ProductDetails from "@/pages/product";
import { HttpTypes } from "@medusajs/types";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/$countryCode/products/$handle")({
  loader: async ({ params, context }) => {
    const { countryCode, handle } = params;
    const { queryClient } = context;

    const region = await queryClient.ensureQueryData({
      queryKey: ["region", countryCode],
      queryFn: () => getRegion({ country_code: countryCode }),
    });

    if (!region || !handle) {
      throw notFound();
    }

    // Single comprehensive product fetch with all needed fields
    const product = await queryClient.ensureQueryData({
      queryKey: ["product", handle, region.id],
      queryFn: async () => {
        try {
          return await retrieveProduct({
            handle,
            region_id: region.id,
            fields:
              "*variants, +variants.inventory_quantity, +variants.manage_inventory, +variants.allow_backorder, +variants.calculated_price, *images, *options, *options.values, *collection, *tags",
          });
        } catch {
          throw notFound();
        }
      },
    });

    // Fetch pharma metadata via custom endpoint using SDK (auto-includes publishable key + auth)
    let pharma: { drug_product: any } | null = null
    try {
      pharma = await sdk.client.fetch<{ drug_product: any }>(
        `/store/products/pharma?handle=${encodeURIComponent(handle)}`,
        { method: "GET" }
      )
    } catch {
      // pharma metadata unavailable — non-pharma product or module not loaded
    }

    if (pharma?.drug_product) {
      ;(product as any).drug_product = pharma.drug_product
    }

    // Pre-fetch related products for SSR hydration consistency.
    // Medusa v2: collection_id alone can 500 for some collections; tag_id is more reliable.
    // Use tag_id when available, else collection_id, else no filter. try/catch keeps page from crashing.
    await queryClient.ensureQueryData({
      queryKey: queryKeys.products.related(product.id, region.id),
      queryFn: async () => {
        try {
          const baseParams: HttpTypes.StoreProductListParams = {
            // `+variants.calculated_price` can break list endpoint parsing in Medusa v2.
            // Keep fields simple for related-products prefetch to avoid 500 responses.
            fields: "title, handle, *thumbnail, *variants",
            is_giftcard: false,
            limit: 4,
          }

          const filterParams: HttpTypes.StoreProductListParams =
            product.tags && product.tags.length > 0
              ? { ...baseParams, tag_id: product.tags.map((t) => t.id) }
              : product.collection_id
                ? { ...baseParams, collection_id: [product.collection_id] }
                : baseParams

          const { products } = await listProducts({
            query_params: filterParams,
            region_id: region.id,
          })

          return products.filter((p) => p.id !== product.id)
        } catch {
          return []
        }
      },
    });

    return {
      countryCode,
      region,
      product: product as HttpTypes.StoreProduct,
    };
  },
  head: ({ loaderData }) => {
    const { product, region } = loaderData || {};

    if (!product) {
      return {
        meta: [
          {
            title: "Product Not Found | Suprameds",
          },
        ],
      };
    }

    // Create structured data for SEO
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description: product.description,
      image: product.images?.map((img) => img.url).filter(Boolean) || [],
      brand: {
        "@type": "Brand",
        name: "Suprameds",
      },
      offers: {
        "@type": "Offer",
        availability: "https://schema.org/InStock",
        priceCurrency: region?.currency_code?.toUpperCase(),
        price: product.variants?.[0]?.calculated_price?.calculated_amount
          ? product.variants[0].calculated_price.calculated_amount.toFixed(2)
          : undefined,
      },
    };

    // Get first product image for preloading (critical for LCP)
    const firstImageUrl = product.images?.[0]?.url || product.thumbnail;

    return {
      meta: [
        {
          title: `${product.title} | Suprameds`,
        },
        {
          name: "description",
          content: product.description || "Product details",
        },
        {
          property: "og:title",
          content: `${product.title} | Suprameds`,
        },
        {
          property: "og:description",
          content:
            product.description || "Check out this product on Suprameds",
        },
        {
          property: "og:image",
          content: product.thumbnail || "",
        },
      ],
      links: firstImageUrl
        ? [
            {
              rel: "preload",
              href: firstImageUrl,
              as: "image",
              fetchPriority: "high",
            },
          ]
        : [],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(structuredData),
        },
      ],
    };
  },
  component: ProductDetails,
});
