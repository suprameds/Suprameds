import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useNotifications, useMarkAsRead } from "@/lib/hooks/use-notifications"

export const Route = createFileRoute(
  "/$countryCode/account/_layout/messages"
)({
  head: () => ({
    meta: [
      { title: "Messages | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MessagesPage,
})

function MessagesPage() {
  const [page, setPage] = useState(0)
  const limit = 20
  const { data, isLoading } = useNotifications(limit, page * limit)
  const markAsRead = useMarkAsRead()

  const notifications = data?.notifications ?? []
  const totalCount = data?.count ?? 0
  const totalPages = Math.ceil(totalCount / limit)

  const handleNotificationClick = (id: string, read: boolean) => {
    if (!read) {
      markAsRead.mutate(id)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1
          className="text-xl font-semibold"
          style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}
        >
          Messages
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
          Notifications about your orders, prescriptions and account
        </p>
      </div>

      {isLoading ? (
        <div
          className="bg-[var(--bg-secondary)] border rounded-xl p-8 text-center"
          style={{ borderColor: "var(--border-primary)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Loading messages...
          </p>
        </div>
      ) : notifications.length === 0 ? (
        <div
          className="bg-[var(--bg-secondary)] border rounded-xl p-12 text-center"
          style={{ borderColor: "var(--border-primary)" }}
        >
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
            style={{ background: "var(--bg-tertiary)" }}
          >
            <BellOffIcon />
          </div>
          <h3
            className="text-base font-semibold mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            No messages yet
          </h3>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            We'll notify you about order updates, prescription status and more.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() =>
                  handleNotificationClick(notification.id, notification.read)
                }
                className="w-full text-left bg-[var(--bg-secondary)] border rounded-xl p-4 sm:p-5 flex items-start gap-3 transition-all hover:shadow-sm"
                style={{
                  borderColor: notification.read
                    ? "var(--border-primary)"
                    : "var(--brand-green)",
                  opacity: notification.read ? 0.85 : 1,
                }}
              >
                {/* Unread dot */}
                <div className="flex-shrink-0 pt-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: notification.read
                        ? "var(--border-primary)"
                        : "var(--brand-green)",
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="text-sm leading-snug"
                      style={{
                        color: "var(--text-primary)",
                        fontWeight: notification.read ? 400 : 600,
                      }}
                    >
                      {notification.title}
                    </p>
                    <span
                      className="flex-shrink-0 text-xs whitespace-nowrap"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {formatRelativeTime(notification.created_at)}
                    </span>
                  </div>
                  {notification.body && (
                    <p
                      className="text-sm mt-1 leading-relaxed line-clamp-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {notification.body}
                    </p>
                  )}
                  {notification.type && (
                    <span
                      className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--bg-tertiary)",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {formatNotificationType(notification.type)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                Previous
              </button>
              <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---- Helpers ----

function formatRelativeTime(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffMs = now - then

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return "Just now"

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`

  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })
}

function formatNotificationType(type: string): string {
  return type
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---- Icons ----

const BellOffIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--text-tertiary)"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)
