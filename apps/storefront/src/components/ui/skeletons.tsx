import React from "react"
import { clsx } from "clsx"

// Base pulse bar
const Bone = ({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) => (
  <div
    className={clsx("animate-pulse rounded", className)}
    style={{ background: "var(--border-primary)", ...style }}
  />
)

// Product grid skeleton (used on home, store, category pages)
export const ProductGridSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="rounded-xl border overflow-hidden"
        style={{
          borderColor: "var(--border-primary)",
          background: "var(--bg-secondary)",
        }}
      >
        <Bone className="w-full h-48" />
        <div className="p-3 space-y-2">
          <Bone className="h-4 w-3/4" />
          <Bone className="h-3 w-1/2" />
          <div className="flex justify-between items-center pt-1">
            <Bone className="h-5 w-16" />
            <Bone className="h-3 w-12" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

// Product detail skeleton
export const ProductDetailSkeleton = () => (
  <div className="content-container py-8">
    <div className="flex flex-col lg:flex-row gap-8">
      <Bone className="w-full lg:w-1/2 h-80 rounded-xl" />
      <div className="flex-1 space-y-4">
        <Bone className="h-8 w-3/4" />
        <Bone className="h-4 w-1/2" />
        <Bone className="h-6 w-24" />
        <Bone className="h-10 w-40 rounded-lg" />
        <div className="space-y-2 pt-4">
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-5/6" />
          <Bone className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  </div>
)

// Store page skeleton (header + filter chips + product grid)
export const StorePageSkeleton = () => (
  <div style={{ background: "var(--bg-primary)", minHeight: "80vh" }}>
    <div style={{ background: "var(--bg-inverse)" }}>
      <div className="content-container py-8 lg:py-10">
        <Bone
          className="h-8 w-48 mb-2"
          style={{ background: "rgba(255,255,255,0.1)" }}
        />
        <Bone
          className="h-4 w-72"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
      </div>
    </div>
    <div className="content-container py-8">
      <div className="flex gap-2 mb-6">
        {[80, 60, 50, 60, 70, 80, 60].map((w, i) => (
          <Bone key={i} className="h-9 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <ProductGridSkeleton count={8} />
    </div>
  </div>
)

// Home page skeleton (hero + category chips + product section)
export const HomePageSkeleton = () => (
  <div style={{ background: "var(--bg-primary)" }}>
    {/* Hero skeleton */}
    <div style={{ background: "var(--bg-inverse)" }}>
      <div className="content-container py-12 lg:py-16">
        <Bone
          className="h-10 w-80 mb-3"
          style={{ background: "rgba(255,255,255,0.1)" }}
        />
        <Bone
          className="h-5 w-96 mb-6"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />
        <div className="flex gap-3">
          <Bone
            className="h-10 w-40 rounded-lg"
            style={{ background: "rgba(255,255,255,0.1)" }}
          />
          <Bone
            className="h-10 w-44 rounded-lg"
            style={{ background: "rgba(255,255,255,0.1)" }}
          />
        </div>
      </div>
    </div>
    {/* Category + products skeleton */}
    <div className="content-container py-8">
      <div className="flex gap-3 mb-6">
        {[90, 70, 100, 80].map((w, i) => (
          <Bone key={i} className="h-10 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <Bone className="h-6 w-36 mb-4" />
      <ProductGridSkeleton count={4} />
    </div>
  </div>
)

// Account list skeleton (for orders, prescriptions, wishlist)
export const AccountListSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="rounded-xl border p-5 flex items-center justify-between"
        style={{
          borderColor: "var(--border-primary)",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3">
            <Bone className="h-4 w-24" />
            <Bone className="h-5 w-16 rounded-full" />
          </div>
          <Bone className="h-3 w-32" />
        </div>
        <Bone className="h-8 w-24 rounded-lg" />
      </div>
    ))}
  </div>
)

// Cart skeleton
export const CartSkeleton = () => (
  <div className="content-container py-8">
    <Bone className="h-7 w-32 mb-6" />
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1 space-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex gap-4 p-4 rounded-xl border"
            style={{
              borderColor: "var(--border-primary)",
              background: "var(--bg-secondary)",
            }}
          >
            <Bone className="w-20 h-20 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Bone className="h-4 w-40" />
              <Bone className="h-3 w-24" />
              <Bone className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="lg:w-80">
        <div
          className="rounded-xl border p-5 space-y-3"
          style={{
            borderColor: "var(--border-primary)",
            background: "var(--bg-secondary)",
          }}
        >
          <Bone className="h-5 w-32" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-full" />
          <Bone className="h-px w-full" />
          <Bone className="h-5 w-full" />
          <Bone className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  </div>
)

// Inline spinner for buttons/actions
export const Spinner = ({ size = 16 }: { size?: number }) => (
  <div
    className="border-2 rounded-full animate-spin"
    style={{
      width: size,
      height: size,
      borderColor: "var(--border-primary)",
      borderTopColor: "var(--brand-teal)",
    }}
  />
)
