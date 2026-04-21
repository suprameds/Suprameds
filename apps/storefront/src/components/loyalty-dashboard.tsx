import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "@/lib/utils/sdk"
import { queryKeys } from "@/lib/utils/query-keys"
import { getStoredOtpToken } from "@/lib/hooks/use-customer"
import { SITE_URL } from "@/lib/constants/site"

// ── Types ────────────────────────────────────────────────────────────

interface LoyaltyTransaction {
  id: string
  date: string
  type: "earn" | "redeem" | "expire"
  points: number
  description: string
}

/** Shape returned by GET /store/loyalty/account */
interface LoyaltyApiResponse {
  account: {
    id: string
    points_balance: number
    tier: string
    lifetime_points: number
    referral_code?: string
  }
  transactions: Array<{
    id: string
    type: string
    points: number
    reason: string
    reference_type?: string
    reference_id?: string
    created_at: string
  }>
  tier_progress: {
    current_tier: string
    next_tier: string | null
    points_to_next_tier: number
    progress_percent: number
  }
}

interface LoyaltyAccount {
  points_balance: number
  tier: "Bronze" | "Silver" | "Gold" | "Platinum"
  tier_progress: number
  next_tier: string | null
  points_to_next_tier: number
  referral_code: string | null
  transactions: LoyaltyTransaction[]
}

// ── Tier config ──────────────────────────────────────────────────────

const TIER_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  Bronze:   { color: "var(--brand-amber-dark)", bg: "#FFFBEB", border: "#FDE68A" },
  Silver:   { color: "#374151", bg: "#F3F4F6", border: "#D1D5DB" },
  Gold:     { color: "var(--brand-amber-dark)", bg: "#FEF3C7", border: "var(--brand-amber)" },
  Platinum: { color: "#1E3A5F", bg: "#EFF6FF", border: "#60A5FA" },
}

// ── Hook ─────────────────────────────────────────────────────────────

function useLoyaltyAccount() {
  return useQuery<LoyaltyAccount>({
    queryKey: queryKeys.loyalty.account(),
    queryFn: async () => {
      const otpToken = getStoredOtpToken()
      const headers: Record<string, string> = {}
      if (otpToken) headers.Authorization = `Bearer ${otpToken}`

      const raw = await sdk.client.fetch<LoyaltyApiResponse>(
        "/store/loyalty/account",
        { method: "GET", headers }
      )

      // Capitalize tier name to match TIER_CONFIG keys (backend stores lowercase)
      const tierRaw = raw.account?.tier ?? "bronze"
      const tier = (tierRaw.charAt(0).toUpperCase() + tierRaw.slice(1)) as LoyaltyAccount["tier"]

      return {
        points_balance: raw.account?.points_balance ?? 0,
        tier,
        tier_progress: raw.tier_progress?.progress_percent ?? 0,
        next_tier: raw.tier_progress?.next_tier
          ? raw.tier_progress.next_tier.charAt(0).toUpperCase() + raw.tier_progress.next_tier.slice(1)
          : null,
        points_to_next_tier: raw.tier_progress?.points_to_next_tier ?? 0,
        referral_code: raw.account?.referral_code ?? null,
        transactions: (raw.transactions ?? []).map((t) => ({
          id: t.id,
          date: t.created_at,
          type: t.type as LoyaltyTransaction["type"],
          points: t.points,
          description: t.reason ?? "",
        })),
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}

// ── Component ────────────────────────────────────────────────────────

export default function LoyaltyDashboard() {
  const { data, isLoading, isError } = useLoyaltyAccount()

  if (isLoading) {
    return <LoyaltySkeleton />
  }

  // Graceful fallback if the API isn't available yet or data is malformed
  if (isError || !data || typeof data.points_balance !== "number") {
    return <LoyaltyComingSoon />
  }

  const tierStyle = TIER_CONFIG[data.tier] ?? TIER_CONFIG.Bronze
  const progressPercent = Math.min(Math.max(data.tier_progress ?? 0, 0), 100)

  return (
    <div className="flex flex-col gap-5">
      {/* Points balance + tier card */}
      <div className="bg-[var(--bg-secondary)] border rounded-xl p-6" style={{ borderColor: "var(--border-primary)" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              Loyalty Points
            </p>
            <p className="text-3xl font-bold mt-1" style={{ color: "var(--price-color)" }}>
              {data.points_balance.toLocaleString("en-IN")}
            </p>
          </div>
          {/* Tier badge */}
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
            style={{ color: tierStyle.color, background: tierStyle.bg, borderColor: tierStyle.border }}
          >
            <TierIcon tier={data.tier} />
            {data.tier}
          </span>
        </div>

        {/* Progress to next tier */}
        {data.next_tier && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Progress to {data.next_tier}
              </p>
              <p className="text-xs font-medium" style={{ color: "#374151" }}>
                {data.points_to_next_tier.toLocaleString("en-IN")} pts to go
              </p>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#E5E7EB" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercent}%`,
                  background: "linear-gradient(90deg, var(--brand-teal), var(--price-color))",
                }}
              />
            </div>
          </div>
        )}

        {/* Earn rate info */}
        <div
          className="mt-4 p-3 rounded-lg flex items-center gap-2"
          style={{ background: "#F0FDF4" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--price-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <p className="text-xs" style={{ color: "#166534" }}>
            Earn <span className="font-semibold">1 point per ₹50</span> on OTC medicines. 1 point = ₹1 discount.
          </p>
        </div>
      </div>

      {/* Referral code card */}
      {data.referral_code && (
        <ReferralCard code={data.referral_code} />
      )}

      {/* Recent transactions */}
      {data.transactions.length > 0 && (
        <div className="bg-[var(--bg-secondary)] border rounded-xl p-6" style={{ borderColor: "var(--border-primary)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "#374151" }}>
            Recent Activity
          </h3>
          <div className="flex flex-col divide-y" style={{ borderColor: "#F3F4F6" }}>
            {data.transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Compact points badge for the navbar / sidebar */
export function LoyaltyPointsBadge({ points }: { points: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ color: "var(--price-color)", background: "#DCFCE7" }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      {points.toLocaleString("en-IN")}
    </span>
  )
}

// ── Referral Card ───────────────────────────────────────────────────

function ReferralCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const referralLink = `${SITE_URL}/in/account/register?ref=${code}`
  const whatsappText = encodeURIComponent(
    `Hey! I use Suprameds for affordable generic medicines. Use my referral code ${code} to get 50 bonus loyalty points on signup!\n\n${referralLink}`
  )

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const el = document.createElement("textarea")
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="bg-[var(--bg-secondary)] border rounded-xl p-6" style={{ borderColor: "var(--border-primary)" }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "#374151" }}>
        Refer a Friend
      </h3>
      <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
        Share your code. You both get <strong>50 bonus points</strong> when they make their first order.
      </p>

      {/* Code display */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-lg border mb-3"
        style={{ background: "#F0FDF4", borderColor: "#A7F3D0" }}
      >
        <span
          className="text-lg font-bold tracking-widest"
          style={{ color: "var(--price-color)", fontFamily: "monospace" }}
        >
          {code}
        </span>
        <button
          onClick={() => handleCopy(code)}
          className="text-xs font-medium px-3 py-1.5 rounded-md border transition-all cursor-pointer"
          style={{
            color: copied ? "#fff" : "var(--price-color)",
            background: copied ? "var(--price-color)" : "transparent",
            borderColor: "var(--price-color)",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Share buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleCopy(referralLink)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all hover:opacity-80 cursor-pointer"
          style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Copy Link
        </button>
        <a
          href={`https://wa.me/?text=${whatsappText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
          style={{ background: "#25D366" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </a>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────

function TransactionRow({ tx }: { tx: LoyaltyTransaction }) {
  const isPositive = tx.type === "earn"
  const isNegative = tx.type === "redeem" || tx.type === "expire"

  const typeLabels: Record<string, string> = {
    earn: "Earned",
    redeem: "Redeemed",
    expire: "Expired",
  }

  const typeColors: Record<string, string> = {
    earn: "var(--price-color)",
    redeem: "var(--brand-red)",
    expire: "var(--brand-amber)",
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: tx.type === "earn" ? "#DCFCE7" : tx.type === "redeem" ? "#FEE2E2" : "#FEF3C7",
          }}
        >
          {tx.type === "earn" && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--price-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          )}
          {tx.type === "redeem" && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          )}
          {tx.type === "expire" && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-amber)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "#111827" }}>
            {tx.description}
          </p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {new Date(tx.date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {" · "}
            <span style={{ color: typeColors[tx.type] }}>{typeLabels[tx.type]}</span>
          </p>
        </div>
      </div>
      <span
        className="text-sm font-semibold flex-shrink-0 ml-3"
        style={{ color: isPositive ? "var(--price-color)" : isNegative ? "var(--brand-red)" : "#374151" }}
      >
        {isPositive ? "+" : "-"}{Math.abs(tx.points).toLocaleString("en-IN")}
      </span>
    </div>
  )
}

function TierIcon({ tier }: { tier: string }) {
  const color = tier === "Gold" || tier === "Bronze" ? "var(--brand-amber)"
    : tier === "Platinum" ? "#3B82F6"
    : "var(--text-secondary)"
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={color} stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function LoyaltySkeleton() {
  return (
    <div className="bg-[var(--bg-secondary)] border rounded-xl p-6 animate-pulse" style={{ borderColor: "var(--border-primary)" }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="h-3 w-20 rounded" style={{ background: "#E5E7EB" }} />
          <div className="h-8 w-32 rounded mt-2" style={{ background: "#E5E7EB" }} />
        </div>
        <div className="h-7 w-20 rounded-full" style={{ background: "#E5E7EB" }} />
      </div>
      <div className="h-2 w-full rounded-full" style={{ background: "#E5E7EB" }} />
    </div>
  )
}

function LoyaltyComingSoon() {
  return (
    <div
      className="bg-[var(--bg-secondary)] border rounded-xl p-6 text-center"
      style={{ borderColor: "var(--border-primary)" }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
        style={{ background: "#F0FDF4" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--price-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </div>
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Loyalty Program Coming Soon!
      </h3>
      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
        Earn points on every OTC purchase and unlock exclusive rewards.
        We're rolling this out soon — stay tuned!
      </p>
    </div>
  )
}
