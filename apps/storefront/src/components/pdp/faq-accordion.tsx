import { useState } from "react"

interface FAQAccordionProps {
  faqs?: { q: string; a: string }[] | null
}

export default function FAQAccordion({ faqs }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (!faqs || faqs.length === 0) return null

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
      <div className="px-4 py-3" style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-primary)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}>
          Frequently Asked Questions
        </h2>
      </div>
      <div style={{ background: "var(--bg-secondary)" }}>
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i
          return (
            <div key={i} style={{ borderBottom: i < faqs.length - 1 ? "1px solid var(--border-secondary)" : undefined }}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-start justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50/50 gap-3"
              >
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {faq.q}
                </span>
                <span
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold mt-0.5"
                  style={{
                    background: isOpen ? "var(--brand-teal)" : "var(--border-secondary)",
                    color: isOpen ? "var(--text-inverse)" : "var(--text-secondary)",
                  }}
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <div className="px-4 pb-3">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
