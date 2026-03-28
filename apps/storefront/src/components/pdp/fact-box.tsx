interface FactBoxProps {
  chemicalClass?: string | null
  therapeuticClass?: string | null
  actionClass?: string | null
  habitForming?: boolean
}

export default function FactBox({ chemicalClass, therapeuticClass, actionClass, habitForming }: FactBoxProps) {
  if (!chemicalClass && !therapeuticClass && !actionClass && habitForming === undefined) return null

  const items = [
    { label: "Chemical Class", value: chemicalClass },
    { label: "Therapeutic Class", value: therapeuticClass },
    { label: "Action Class", value: actionClass },
    {
      label: "Habit Forming",
      value: habitForming === undefined ? null : habitForming ? "Yes" : "No",
      color: habitForming ? "#DC2626" : "#16A34A",
    },
  ].filter((i) => i.value)

  if (items.length === 0) return null

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #EDE9E1" }}>
      <div className="px-4 py-3" style={{ background: "#F8F6F2", borderBottom: "1px solid #EDE9E1" }}>
        <h2 className="text-sm font-semibold" style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}>
          Fact Box
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0" style={{ background: "#fff" }}>
        {items.map((item, i) => (
          <div
            key={item.label}
            className="px-4 py-3"
            style={{ borderBottom: i < items.length - (items.length % 2 === 0 ? 2 : 1) ? "1px solid #F3F0EB" : undefined }}
          >
            <div className="text-[11px] font-medium mb-0.5" style={{ color: "#9CA3AF" }}>
              {item.label}
            </div>
            <div className="text-sm font-medium" style={{ color: item.color || "#0D1B2A" }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
