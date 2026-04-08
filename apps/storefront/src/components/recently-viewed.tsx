import { useState, useEffect } from "react"
import { Link } from "@tanstack/react-router"
import { getRecentlyViewed, type RecentlyViewedItem } from "@/lib/utils/recently-viewed"

export function RecentlyViewed({ countryCode }: { countryCode: string }) {
  const [items, setItems] = useState<RecentlyViewedItem[]>([])

  useEffect(() => {
    setItems(getRecentlyViewed())
  }, [])

  if (!items.length) return null

  return (
    <section className="content-container py-10 lg:py-14">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--brand-teal)" }}
          >
            Browsing history
          </p>
          <h2
            className="text-2xl lg:text-3xl font-semibold"
            style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}
          >
            Recently viewed
          </h2>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
        {items.map((item) => (
          <Link
            key={item.id}
            to="/$countryCode/products/$handle"
            params={{ countryCode, handle: item.handle }}
            className="flex-shrink-0 w-36 sm:w-44 group"
          >
            <div
              className="aspect-square rounded-xl overflow-hidden border mb-2 bg-white"
              style={{ borderColor: "var(--border-primary)" }}
            >
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "var(--bg-secondary)" }}
                >
                  <PillIcon />
                </div>
              )}
            </div>
            <p
              className="text-sm font-medium line-clamp-2 group-hover:underline"
              style={{ color: "var(--text-primary)" }}
            >
              {item.title}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}

const PillIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
    <path d="m8.5 8.5 7 7" />
  </svg>
)
