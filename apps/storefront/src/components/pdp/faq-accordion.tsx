import { useState } from "react"

interface FAQAccordionProps {
  faqs?: { q: string; a: string }[] | null
}

export default function FAQAccordion({ faqs }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (!faqs || faqs.length === 0) return null

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #EDE9E1" }}>
      <div className="px-4 py-3" style={{ background: "#F8F6F2", borderBottom: "1px solid #EDE9E1" }}>
        <h2 className="text-sm font-semibold" style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}>
          Frequently Asked Questions
        </h2>
      </div>
      <div style={{ background: "#fff" }}>
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i
          return (
            <div key={i} style={{ borderBottom: i < faqs.length - 1 ? "1px solid #F3F0EB" : undefined }}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-start justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50/50 gap-3"
              >
                <span className="text-sm font-medium" style={{ color: "#0D1B2A" }}>
                  {faq.q}
                </span>
                <span
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold mt-0.5"
                  style={{
                    background: isOpen ? "#0E7C86" : "#F3F0EB",
                    color: isOpen ? "#fff" : "#6B7280",
                  }}
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <div className="px-4 pb-3">
                  <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>
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
