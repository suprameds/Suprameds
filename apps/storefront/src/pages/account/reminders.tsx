import { useState, useRef, useEffect } from "react"
import { Link, useLocation } from "@tanstack/react-router"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import {
  useReminders,
  useCreateReminder,
  useUpdateReminder,
  useDeleteReminder,
  type Reminder,
} from "@/lib/hooks/use-reminders"
import { sdk } from "@/lib/utils/sdk"

const TEAL = "#0E7C86"
const NAVY = "#0D1B2A"

const FREQUENCY_PRESETS = [
  { label: "Weekly", days: 7 },
  { label: "Fortnightly", days: 14 },
  { label: "Monthly", days: 30 },
  { label: "Every 2 months", days: 60 },
  { label: "Every 3 months", days: 90 },
]

type SearchResult = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  variants: { id: string; title: string }[]
}

export default function RemindersPage() {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const { data, isLoading, isError } = useReminders()
  const createReminder = useCreateReminder()
  const updateReminder = useUpdateReminder()
  const deleteReminder = useDeleteReminder()

  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState("")
  const [frequencyDays, setFrequencyDays] = useState(30)
  const [customDays, setCustomDays] = useState("")
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const reminders = data?.reminders ?? []
  const activeReminders = reminders.filter((r) => r.is_active)
  const pausedReminders = reminders.filter((r) => !r.is_active)

  // Debounced product search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await sdk.store.product.list({
          q: searchQuery,
          limit: 6,
          fields: "id,title,handle,thumbnail,variants.id,variants.title",
        })
        setSearchResults(
          (res.products ?? []).map((p: any) => ({
            id: p.id,
            title: p.title,
            handle: p.handle,
            thumbnail: p.thumbnail,
            variants: (p.variants ?? []).map((v: any) => ({
              id: v.id,
              title: v.title,
            })),
          }))
        )
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 350)

    return () => clearTimeout(searchTimeout.current)
  }, [searchQuery])

  const handleSelectProduct = (product: SearchResult) => {
    setSelectedProduct(product)
    setSearchQuery("")
    setSearchResults([])
    if (product.variants.length === 1) {
      setSelectedVariantId(product.variants[0].id)
    } else {
      setSelectedVariantId("")
    }
  }

  const handleCreate = () => {
    if (!selectedVariantId) return
    const days =
      frequencyDays === -1 ? parseInt(customDays, 10) || 30 : frequencyDays

    createReminder.mutate(
      { variant_id: selectedVariantId, frequency_days: days },
      {
        onSuccess: () => {
          setShowAddForm(false)
          setSelectedProduct(null)
          setSelectedVariantId("")
          setFrequencyDays(30)
          setCustomDays("")
          setSearchQuery("")
        },
      }
    )
  }

  const handleToggle = (reminder: Reminder) => {
    updateReminder.mutate({ id: reminder.id, is_active: !reminder.is_active })
  }

  const handleDelete = (id: string) => {
    deleteReminder.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    })
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getDueStatus = (
    nextExpected: string,
    isActive: boolean
  ): { label: string; color: string; bg: string } => {
    if (!isActive) return { label: "Paused", color: "#6B7280", bg: "#F3F4F6" }
    const now = Date.now()
    const next = new Date(nextExpected).getTime()
    const daysLeft = Math.ceil((next - now) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0) return { label: "Overdue", color: "#B91C1C", bg: "#FEF2F2" }
    if (daysLeft <= 3) return { label: "Due soon", color: "#D97706", bg: "#FEF3C7" }
    return { label: `In ${daysLeft} days`, color: "#059669", bg: "#ECFDF5" }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: "#9CA3AF" }}>
          Loading reminders...
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: NAVY, fontFamily: "Fraunces, Georgia, serif" }}
          >
            Refill Reminders
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            {reminders.length > 0
              ? `${activeReminders.length} active reminder${activeReminders.length !== 1 ? "s" : ""}`
              : "Never run out of your regular medicines"}
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: TEAL }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Reminder
          </button>
        )}
      </div>

      {/* Add Reminder Form */}
      {showAddForm && (
        <div
          className="mb-6 p-5 rounded-xl border"
          style={{ background: "#fff", borderColor: "#EDE9E1" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: NAVY }}>
              Add a new refill reminder
            </h2>
            <button
              onClick={() => {
                setShowAddForm(false)
                setSelectedProduct(null)
                setSearchQuery("")
              }}
              className="text-xs font-medium hover:underline"
              style={{ color: "#6B7280" }}
            >
              Cancel
            </button>
          </div>

          {/* Step 1: Search for medicine */}
          {!selectedProduct ? (
            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: "#374151" }}>
                Search for a medicine
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type medicine name, e.g. Metformin..."
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2"
                  style={{ borderColor: "#D1D5DB" }}
                />
                {isSearching && (
                  <div className="absolute right-3 top-3">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-teal-600 rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {searchResults.length > 0 && (
                <div
                  className="mt-2 border rounded-lg overflow-hidden"
                  style={{ borderColor: "#EDE9E1" }}
                >
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#FAFAF8] transition-colors border-b last:border-b-0"
                      style={{ borderColor: "#F3F0EB" }}
                    >
                      {product.thumbnail ? (
                        <img
                          src={product.thumbnail}
                          alt=""
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                          style={{ background: "#F3F0EB" }}
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: "#F3F0EB" }}
                        >
                          <PillIcon />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: NAVY }}>
                          {product.title}
                        </p>
                        <p className="text-xs" style={{ color: "#9CA3AF" }}>
                          {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                <p className="mt-2 text-sm" style={{ color: "#9CA3AF" }}>
                  No medicines found for "{searchQuery}"
                </p>
              )}
            </div>
          ) : (
            <div>
              {/* Selected product */}
              <div className="flex items-center gap-3 p-3 rounded-lg mb-4" style={{ background: "#F8F6F2" }}>
                {selectedProduct.thumbnail ? (
                  <img src={selectedProduct.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: "#EDE9E1" }}><PillIcon /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: NAVY }}>{selectedProduct.title}</p>
                </div>
                <button
                  onClick={() => { setSelectedProduct(null); setSelectedVariantId("") }}
                  className="text-xs font-medium hover:underline"
                  style={{ color: TEAL }}
                >
                  Change
                </button>
              </div>

              {/* Variant selection (if multiple) */}
              {selectedProduct.variants.length > 1 && (
                <div className="mb-4">
                  <label className="text-sm font-medium block mb-1.5" style={{ color: "#374151" }}>
                    Select variant
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariantId(v.id)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                        style={{
                          borderColor: selectedVariantId === v.id ? TEAL : "#D1D5DB",
                          background: selectedVariantId === v.id ? "#E0F7FA" : "#fff",
                          color: selectedVariantId === v.id ? TEAL : "#374151",
                        }}
                      >
                        {v.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Frequency */}
              <div className="mb-4">
                <label className="text-sm font-medium block mb-1.5" style={{ color: "#374151" }}>
                  Remind me every
                </label>
                <div className="flex flex-wrap gap-2">
                  {FREQUENCY_PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      onClick={() => { setFrequencyDays(preset.days); setCustomDays("") }}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                      style={{
                        borderColor: frequencyDays === preset.days ? TEAL : "#D1D5DB",
                        background: frequencyDays === preset.days ? "#E0F7FA" : "#fff",
                        color: frequencyDays === preset.days ? TEAL : "#374151",
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setFrequencyDays(-1)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                    style={{
                      borderColor: frequencyDays === -1 ? TEAL : "#D1D5DB",
                      background: frequencyDays === -1 ? "#E0F7FA" : "#fff",
                      color: frequencyDays === -1 ? TEAL : "#374151",
                    }}
                  >
                    Custom
                  </button>
                </div>
                {frequencyDays === -1 && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      placeholder="e.g. 45"
                      className="w-24 px-3 py-2 rounded-lg border text-sm outline-none"
                      style={{ borderColor: "#D1D5DB" }}
                    />
                    <span className="text-sm" style={{ color: "#6B7280" }}>days</span>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={handleCreate}
                disabled={
                  !selectedVariantId ||
                  createReminder.isPending ||
                  (frequencyDays === -1 && (!customDays || parseInt(customDays) < 1))
                }
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: TEAL }}
              >
                {createReminder.isPending ? "Creating..." : "Create Reminder"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="p-4 rounded-lg mb-6" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <p className="text-sm" style={{ color: "#B91C1C" }}>
            Failed to load reminders. Please try again later.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && reminders.length === 0 && !showAddForm && (
        <div
          className="text-center py-12 rounded-xl border"
          style={{ background: "#fff", borderColor: "#EDE9E1" }}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "#F0FDFA", color: TEAL }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: NAVY }}>
            No reminders yet
          </h3>
          <p className="text-sm mb-4 max-w-sm mx-auto" style={{ color: "#6B7280" }}>
            Add a refill reminder for your regular medicines so you never run out.
            We'll also automatically detect patterns once you've ordered 3+ times.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: TEAL }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add your first reminder
          </button>
        </div>
      )}

      {/* Reminder list */}
      {reminders.length > 0 && (
        <div className="space-y-3">
          {/* Info bar */}
          <div className="p-3 rounded-lg text-xs" style={{ background: "#F0FDFA", color: TEAL }}>
            <strong>Auto-detection:</strong> When you order the same medicine 3+ times at
            regular intervals, we automatically create a refill reminder for you.
          </div>

          {/* Active reminders */}
          {activeReminders.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#6B7280" }}>
                Active ({activeReminders.length})
              </h3>
              <div className="space-y-2">
                {activeReminders.map((r) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    countryCode={countryCode}
                    dueStatus={getDueStatus(r.next_expected_at, r.is_active)}
                    onToggle={handleToggle}
                    onDelete={() => setDeleteConfirmId(r.id)}
                    formatDate={formatDate}
                    isDeleting={deleteReminder.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Paused reminders */}
          {pausedReminders.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#9CA3AF" }}>
                Paused ({pausedReminders.length})
              </h3>
              <div className="space-y-2">
                {pausedReminders.map((r) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    countryCode={countryCode}
                    dueStatus={getDueStatus(r.next_expected_at, r.is_active)}
                    onToggle={handleToggle}
                    onDelete={() => setDeleteConfirmId(r.id)}
                    formatDate={formatDate}
                    isDeleting={deleteReminder.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-base font-semibold mb-2" style={{ color: NAVY }}>
              Delete reminder?
            </h3>
            <p className="text-sm mb-5" style={{ color: "#6B7280" }}>
              This will permanently remove this refill reminder. You can always
              create a new one later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: "#D1D5DB", color: "#374151" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteReminder.isPending}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "#B91C1C" }}
              >
                {deleteReminder.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Reminder card sub-component ── */

function ReminderCard({
  reminder,
  countryCode,
  dueStatus,
  onToggle,
  onDelete,
  formatDate,
  isDeleting,
}: {
  reminder: Reminder
  countryCode: string
  dueStatus: { label: string; color: string; bg: string }
  onToggle: (r: Reminder) => void
  onDelete: () => void
  formatDate: (d: string) => string
  isDeleting: boolean
}) {
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl border transition-all"
      style={{
        background: "#fff",
        borderColor: "#EDE9E1",
        opacity: reminder.is_active ? 1 : 0.7,
      }}
    >
      {/* Thumbnail */}
      {reminder.thumbnail ? (
        <img
          src={reminder.thumbnail}
          alt=""
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          style={{ background: "#F3F0EB" }}
        />
      ) : (
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "#F3F0EB" }}
        >
          <PillIcon />
        </div>
      )}

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {reminder.product_handle ? (
              <Link
                to="/$countryCode/products/$handle"
                params={{ countryCode, handle: reminder.product_handle }}
                className="text-sm font-semibold hover:underline truncate block"
                style={{ color: NAVY }}
              >
                {reminder.product_title}
              </Link>
            ) : (
              <p className="text-sm font-semibold truncate" style={{ color: NAVY }}>
                {reminder.product_title}
              </p>
            )}
            {reminder.variant_title && (
              <p className="text-xs" style={{ color: "#9CA3AF" }}>
                {reminder.variant_title}
              </p>
            )}
          </div>

          {/* Status badge */}
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
            style={{ background: dueStatus.bg, color: dueStatus.color }}
          >
            {dueStatus.label}
          </span>
        </div>

        {/* Frequency + dates */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
          <span className="text-xs" style={{ color: "#6B7280" }}>
            Every {reminder.frequency_days} days
          </span>
          <span className="text-xs" style={{ color: "#9CA3AF" }}>
            Next: {formatDate(reminder.next_expected_at)}
          </span>
          {!reminder.is_manual && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: "#F3F4F6", color: "#6B7280" }}
            >
              Auto-detected
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-3">
          <button
            onClick={() => onToggle(reminder)}
            className="text-xs font-medium hover:underline"
            style={{ color: TEAL }}
          >
            {reminder.is_active ? "Pause" : "Resume"}
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="text-xs font-medium hover:underline"
            style={{ color: "#B91C1C" }}
          >
            Delete
          </button>
          {reminder.product_handle && (
            <Link
              to="/$countryCode/products/$handle"
              params={{ countryCode, handle: reminder.product_handle }}
              className="text-xs font-medium hover:underline"
              style={{ color: TEAL }}
            >
              Reorder now
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

const PillIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8">
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
    <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
  </svg>
)
