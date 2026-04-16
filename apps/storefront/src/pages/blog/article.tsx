import { useBlogPost, useBlogPosts } from "@/lib/hooks/use-blog"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { Link, useLocation, useParams } from "@tanstack/react-router"

const categoryColors: Record<string, string> = {
  guides: "var(--brand-teal)",
  health: "var(--brand-green)",
  pharmacy: "#8e44ad",
  savings: "#e67e22",
}

const ArrowLeftIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
)

const BlogArticlePage = () => {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const { slug } = useParams({ strict: false }) as { slug: string }

  const { data: post, isLoading } = useBlogPost(slug)
  const { data: allPostsData } = useBlogPosts()

  const relatedPosts = (allPostsData?.posts ?? [])
    .filter((p) => p.slug !== slug)
    .slice(0, 3)

  if (isLoading) {
    return (
      <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
        <div className="content-container py-8 md:py-12 animate-pulse">
          <div
            className="h-4 w-24 rounded mb-8"
            style={{ background: "var(--bg-tertiary)" }}
          />
          <div className="max-w-3xl">
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
              className="h-10 w-3/4 mb-4 rounded"
              style={{ background: "var(--bg-tertiary)" }}
            />
            <div
              className="h-4 w-1/3 mb-10 rounded"
              style={{ background: "var(--bg-tertiary)" }}
            />
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-4 w-full mb-3 rounded"
                style={{ background: "var(--bg-tertiary)" }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
        <div className="content-container py-16 text-center">
          <p style={{ color: "var(--text-tertiary)" }}>Article not found.</p>
          <Link
            to={"/$countryCode/blog" as any}
            params={{ countryCode } as any}
            className="inline-flex items-center gap-2 mt-4 text-sm font-medium"
            style={{ color: "var(--brand-teal)" }}
          >
            <ArrowLeftIcon />
            Back to Blog
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <div className="content-container py-8 md:py-12">
        {/* Back link */}
        <Link
          to={"/$countryCode/blog" as any}
          params={{ countryCode } as any}
          className="inline-flex items-center gap-2 text-sm font-medium mb-8 transition-colors hover:opacity-70"
          style={{ color: "var(--brand-teal)" }}
        >
          <ArrowLeftIcon />
          Back to Blog
        </Link>

        {/* Article header */}
        <header className="mb-10 max-w-3xl">
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
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {post.read_time}
            </span>
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold tracking-tight leading-tight"
            style={{
              color: "var(--text-primary)",
              fontFamily: "Fraunces, Georgia, serif",
            }}
          >
            {post.title}
          </h1>
          <div
            className="mt-4 flex items-center gap-2 text-sm"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span>{post.author}</span>
            <span>·</span>
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </div>
        </header>

        {/* Article content with prose styling */}
        <article
          className="blog-prose"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* CTA */}
        <div
          className="mt-12 p-6 md:p-8 rounded-xl border"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border-primary)",
          }}
        >
          <p
            className="text-lg font-semibold"
            style={{
              color: "var(--text-primary)",
              fontFamily: "Fraunces, Georgia, serif",
            }}
          >
            Looking for affordable medicines?
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Browse our catalogue of pharmacist-verified generic medicines at 50-80% off MRP.
          </p>
          <Link
            to="/$countryCode/store"
            params={{ countryCode }}
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: "var(--brand-teal)",
              color: "#fff",
            }}
          >
            Browse Medicines
          </Link>
        </div>

        {/* Related articles */}
        {relatedPosts.length > 0 && (
          <div className="mt-16">
            <h2
              className="text-xl font-semibold mb-6"
              style={{
                color: "var(--text-primary)",
                fontFamily: "Fraunces, Georgia, serif",
              }}
            >
              Related Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {relatedPosts.map((rp) => (
                <Link
                  key={rp.slug}
                  to={"/$countryCode/blog/$slug" as any}
                  params={{ countryCode, slug: rp.slug } as any}
                  className="group block p-5 rounded-xl border transition-all hover:shadow-md"
                  style={{
                    background: "var(--bg-secondary)",
                    borderColor: "var(--border-primary)",
                  }}
                >
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide mb-3"
                    style={{
                      background: `color-mix(in srgb, ${categoryColors[rp.category] || "var(--brand-teal)"} 12%, transparent)`,
                      color: categoryColors[rp.category] || "var(--brand-teal)",
                    }}
                  >
                    {rp.category}
                  </span>
                  <h3
                    className="text-sm font-semibold leading-snug group-hover:underline"
                    style={{
                      color: "var(--text-primary)",
                      fontFamily: "Fraunces, Georgia, serif",
                    }}
                  >
                    {rp.title}
                  </h3>
                  <p
                    className="mt-2 text-xs line-clamp-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {rp.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Blog prose styles */}
      <style>{`
        .blog-prose {
          max-width: 720px;
          color: var(--text-primary);
          font-size: 1rem;
          line-height: 1.8;
        }
        .blog-prose h2 {
          font-size: 1.5rem;
          font-weight: 600;
          font-family: Fraunces, Georgia, serif;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          color: var(--text-primary);
        }
        .blog-prose h3 {
          font-size: 1.25rem;
          font-weight: 600;
          font-family: Fraunces, Georgia, serif;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }
        .blog-prose p {
          margin-bottom: 1rem;
          color: var(--text-secondary);
          line-height: 1.8;
        }
        .blog-prose ul,
        .blog-prose ol {
          padding-left: 1.5rem;
          margin-bottom: 1rem;
          color: var(--text-secondary);
        }
        .blog-prose ul {
          list-style-type: disc;
        }
        .blog-prose ol {
          list-style-type: decimal;
        }
        .blog-prose li {
          margin-bottom: 0.5rem;
          line-height: 1.7;
        }
        .blog-prose strong {
          font-weight: 600;
          color: var(--text-primary);
        }
        .blog-prose blockquote {
          border-left: 3px solid var(--brand-teal);
          padding-left: 1.25rem;
          margin: 1.5rem 0;
          font-style: italic;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  )
}

export default BlogArticlePage
