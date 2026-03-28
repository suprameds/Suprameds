import { useState, useRef, useEffect } from "react"

interface ExpandableSectionProps {
  title: string
  content: string | null | undefined
  defaultOpen?: boolean
}

export default function ExpandableSection({ title, content, defaultOpen = false }: ExpandableSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState<string>(defaultOpen ? "none" : "0px")

  useEffect(() => {
    if (isOpen) {
      const el = contentRef.current
      if (el) {
        setMaxHeight(`${el.scrollHeight}px`)
        // After transition, switch to "none" so content can resize naturally
        const timer = setTimeout(() => setMaxHeight("none"), 250)
        return () => clearTimeout(timer)
      }
    } else {
      // Collapse: first set explicit height, then 0
      const el = contentRef.current
      if (el) {
        setMaxHeight(`${el.scrollHeight}px`)
        requestAnimationFrame(() => setMaxHeight("0px"))
      }
    }
  }, [isOpen])

  if (!content) return null

  return (
    <div style={{ borderBottom: "1px solid var(--border-primary)" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-gray-50/50"
      >
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
        style={{ maxHeight }}
      >
        <div className="px-4 pb-4">
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-primary)" }}>
            {content}
          </p>
        </div>
      </div>
    </div>
  )
}
