export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="text-sm px-3.5 py-2.5 rounded-xl border"
      style={{ color: "#B91C1C", background: "#FEF2F2", borderColor: "#FECACA" }}
    >
      {message}
    </div>
  )
}
