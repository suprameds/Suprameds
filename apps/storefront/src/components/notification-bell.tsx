import { Link } from "@tanstack/react-router"
import { useUnreadCount } from "@/lib/hooks/use-notifications"
import { useCustomer } from "@/lib/hooks/use-customer"

export function NotificationBell() {
  const { data: customer } = useCustomer()
  const { data: unreadCount } = useUnreadCount()

  // Only show for logged-in customers
  if (!customer) return null

  const count = typeof unreadCount === "number" ? unreadCount : 0

  return (
    <Link
      to="/account/messages"
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-full transition-all hover:bg-[var(--bg-tertiary)]"
      aria-label={count > 0 ? `${count} unread notifications` : "Notifications"}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white leading-none"
          style={{ background: "var(--brand-red)" }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  )
}
