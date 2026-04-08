import { useWallet } from "@/lib/hooks/use-wallet"

const TYPE_LABELS: Record<string, string> = {
  credit: "Credit",
  debit: "Debit",
}

const REF_LABELS: Record<string, string> = {
  return: "Return Refund",
  cancellation: "Order Cancellation",
  manual: "Manual Adjustment",
  checkout: "Used at Checkout",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function WalletDashboard() {
  const { data, isLoading, error } = useWallet()

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-[var(--bg-secondary)] rounded-xl" />
        <div className="h-32 bg-[var(--bg-secondary)] rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-[var(--text-tertiary)]">
        Unable to load wallet. Please try again later.
      </p>
    )
  }

  const wallet = data?.wallet
  const transactions = data?.transactions ?? []

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[var(--suprameds-navy)] to-[var(--suprameds-charcoal)] p-6 text-white">
        <div className="relative z-10">
          <p className="text-sm font-medium opacity-80 mb-1">Wallet Balance</p>
          <p className="text-3xl font-bold tracking-tight">
            {"\u20B9"}{wallet?.balance ?? 0}
          </p>
          <p className="text-xs opacity-60 mt-2">
            Use this balance at checkout on your next order
          </p>
        </div>
        {/* Decorative circle */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
      </div>

      {/* Transaction History */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Transaction History
        </h3>

        {transactions.length === 0 ? (
          <div className="text-center py-8 bg-[var(--bg-secondary)] rounded-xl">
            <p className="text-sm text-[var(--text-tertiary)]">
              No transactions yet. Wallet credits appear here when you receive refunds from returns or cancellations.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        txn.type === "credit"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {TYPE_LABELS[txn.type] ?? txn.type}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {REF_LABELS[txn.reference_type] ?? txn.reference_type}
                    </span>
                  </div>
                  {txn.reason && (
                    <p className="text-sm text-[var(--text-secondary)] mt-1 truncate">
                      {txn.reason}
                    </p>
                  )}
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    {formatDate(txn.created_at)}
                  </p>
                </div>
                <p
                  className={`text-base font-semibold whitespace-nowrap ml-4 ${
                    txn.type === "credit"
                      ? "text-[var(--suprameds-green)]"
                      : "text-red-600"
                  }`}
                >
                  {txn.type === "credit" ? "+" : "-"}{"\u20B9"}{txn.amount}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
