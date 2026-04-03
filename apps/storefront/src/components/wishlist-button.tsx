import { Heart } from "@medusajs/icons"
import { useWishlist, useAddToWishlist, useRemoveFromWishlist } from "@/lib/hooks/use-wishlist"
import { useRequireAuth } from "@/lib/hooks/use-require-auth"

type Props = {
  productId: string
  variantId?: string
  currentPrice?: number
  className?: string
}

const HeartSolidIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
  </svg>
)

export function WishlistButton({ productId, variantId, currentPrice, className }: Props) {
  const { data } = useWishlist()
  const isWishlisted = data?.wishlist?.some((item) => item.product_id === productId) ?? false
  const addMutation = useAddToWishlist()
  const removeMutation = useRemoveFromWishlist()

  const requireAuth = useRequireAuth()
  const isPending = addMutation.isPending || removeMutation.isPending

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isPending) return
    if (!requireAuth()) return

    if (isWishlisted) {
      removeMutation.mutate({ product_id: productId })
    } else {
      addMutation.mutate({
        product_id: productId,
        variant_id: variantId,
        current_price: currentPrice,
      })
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={[
        "p-2 rounded-full transition-all duration-200 disabled:opacity-60",
        isWishlisted
          ? "text-[var(--brand-red)] bg-white/90 shadow-sm hover:bg-white hover:text-[var(--brand-red)]"
          : "text-[var(--text-tertiary)] bg-white/80 shadow-sm hover:bg-white hover:text-[var(--brand-red)]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      {isWishlisted ? (
        <HeartSolidIcon className="w-5 h-5" />
      ) : (
        <Heart className="w-5 h-5" />
      )}
    </button>
  )
}
