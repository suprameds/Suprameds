import { useBlogPosts } from "@/lib/hooks/use-blog"
import { Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"

const categoryColors: Record<string, string> = {
  guides: "var(--brand-teal)",
  health: "var(--brand-green)",
  pharmacy: "#8e44ad",
  savings: "#e67e22",
}

const categories = [
  { key: "all", label: "All" },
  { key: "guides", label: "Guides" },
  { key: "health", label: "Health" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "savings", label: "Savings" },
]

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

const BlogListPage = () => {
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [searchInput, setSearchInput] = useState("")
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const { data, isLoading } = useBlogPosts(activeCategory, debouncedSearch)
  const posts = data?.posts ?? []

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        <div className="content-container py-12 md:py-16">
          <h1
            className="text-3xl md:text-4xl font-bold tracking-tight"
            style={{
              color: "var(--text-primary)",
              fontFamily: "Fraunces, Georgia, serif",
            }}
          >
            Health &amp; Medicine Blog
          </h1>
          <p
            className="mt-3 text-base md:text-lg max-w-2xl"
            style={{ color: "var(--text-secondary)" }}
          >
            Expert articles on generic medicines, pharmacy tips, and practical health
            guides from India's licensed online pharmacy.
          </p>

          {/* Search bar */}
          <div className="mt-6 max-w-lg">
            <div
              className="flex items-center rounded-xl overflow-hidden"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}
            >
              <div className="pl-4" style={{ color: "var(--text-tertiary)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search articles..."
                className="flex-1 px-3 py-3 text-sm outline-none bg-transparent"
                style={{ color: "var(--text-primary)" }}
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="px-3 text-lg"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="content-container py-8 md:py-12">
        {/* Search results count */}
        {debouncedSearch && !isLoading && (
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            {posts.length} result{posts.length !== 1 ? "s" : ""} for <strong style={{ color: "var(--text-primary)" }}>"{debouncedSearch}"</strong>
          </p>
        )}

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.key
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: isActive ? "var(--brand-teal)" : "var(--bg-secondary)",
                  color: isActive ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${isActive ? "var(--brand-teal)" : "var(--border-primary)"}`,
                }}
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border overflow-hidden animate-pulse"
                style={{
                  background: "var(--bg-secondary)",
                  borderColor: "var(--border-primary)",
                }}
              >
                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="h-6 w-16 rounded-full"
                      style={{ background: "var(--bg-tertiary)" }}
                    />
                    <div
                      className="h-4 w-20"
                      style={{ background: "var(--bg-tertiary)" }}
                    />
                  </div>
                  <div
                    className="h-6 w-3/4 mb-3 rounded"
                    style={{ background: "var(--bg-tertiary)" }}
                  />
                  <div
                    className="h-4 w-full mb-2 rounded"
                    style={{ background: "var(--bg-tertiary)" }}
                  />
                  <div
                    className="h-4 w-2/3 rounded"
                    style={{ background: "var(--bg-tertiary)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Article grid */}
        {!isLoading && posts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post) => (
              <Link
                key={post.slug}
                to={"/blog/$slug" as any}
                params={{ slug: post.slug } as any}
                className="group block rounded-xl border overflow-hidden transition-all hover:shadow-lg"
                style={{
                  background: "var(--bg-secondary)",
                  borderColor: "var(--border-primary)",
                }}
              >
                <div className="p-6 md:p-8">
                  {/* Category badge + read time */}
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
                      style={{
                        background: `color-mix(in srgb, ${categoryColors[post.category] || "var(--brand-teal)"} 12%, transparent)`,
                        color: categoryColors[post.category] || "var(--brand-teal)",
                      }}
                    >
                      {post.category}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {post.read_time}
                    </span>
                  </div>

                  {/* Title */}
                  <h2
                    className="text-xl font-semibold leading-snug group-hover:underline"
                    style={{
                      color: "var(--text-primary)",
                      fontFamily: "Fraunces, Georgia, serif",
                    }}
                  >
                    {post.title}
                  </h2>

                  {/* Description */}
                  <p
                    className="mt-3 text-sm leading-relaxed line-clamp-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {post.description}
                  </p>

                  {/* Date + author */}
                  <div
                    className="mt-5 flex items-center gap-2 text-xs"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <time dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                    <span>·</span>
                    <span>{post.author}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="text-center py-16">
            <p style={{ color: "var(--text-tertiary)" }}>
              No articles in this category yet. Check back soon.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default BlogListPage
