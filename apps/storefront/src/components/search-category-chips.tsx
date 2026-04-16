/** Map category handles → emoji icons for display on chips */
// eslint-disable-next-line react-refresh/only-export-components
export const CATEGORY_ICON_MAP: Record<string, string> = {
  diabetic: "💊",
  hypertension: "❤️",
  "cardiac-care": "❤️",
  gastroenterology: "🩺",
  "pain-fever": "🌡️",
  respiratory: "🫁",
  neurology: "🧠",
  dermatology: "🧴",
  antibiotics: "💉",
  cholesterol: "🔬",
  nephrology: "🫘",
  "vitamins-supplements": "✨",
  gynecology: "🩷",
  "general-medicines": "💊",
  "pain-management": "💊",
  thyroid: "🦋",
  urology: "🫀",
}

const DISEASE_CATEGORIES = [
  { label: "Diabetes", value: "diabetic", icon: "💊" },
  { label: "Heart / BP", value: "hypertension,cardiac-care", icon: "❤️" },
  { label: "Gastro", value: "gastroenterology", icon: "🩺" },
  { label: "Pain & Fever", value: "pain-fever", icon: "🌡️" },
  { label: "Respiratory", value: "respiratory", icon: "🫁" },
  { label: "Neurology", value: "neurology", icon: "🧠" },
  { label: "Dermatology", value: "dermatology", icon: "🧴" },
  { label: "Antibiotics", value: "antibiotics", icon: "💉" },
  { label: "Cholesterol", value: "cholesterol", icon: "🔬" },
  { label: "Kidney", value: "nephrology", icon: "🫘" },
  { label: "Vitamins", value: "vitamins-supplements", icon: "✨" },
]

export function SearchCategoryChips({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (category: string | null) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
      <button
        onClick={() => onSelect(null)}
        className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap"
        style={{
          background: !selected ? "var(--bg-inverse)" : "var(--bg-secondary)",
          color: !selected ? "white" : "var(--text-secondary)",
          borderColor: !selected ? "var(--bg-inverse)" : "var(--border-primary)",
        }}
      >
        All
      </button>
      {DISEASE_CATEGORIES.map((cat) => {
        const isActive = selected === cat.value
        return (
          <button
            key={cat.value}
            onClick={() => onSelect(isActive ? null : cat.value)}
            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap"
            style={{
              background: isActive ? "var(--bg-inverse)" : "var(--bg-secondary)",
              color: isActive ? "white" : "var(--text-secondary)",
              borderColor: isActive ? "var(--bg-inverse)" : "var(--border-primary)",
            }}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        )
      })}
    </div>
  )
}
