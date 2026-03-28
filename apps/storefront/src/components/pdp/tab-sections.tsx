import { useState } from "react"
import FactBox from "@/components/pdp/fact-box"
import SafetyAdvice from "@/components/pdp/safety-advice"
import ExpandableSection from "@/components/pdp/expandable-section"
import QuickTips from "@/components/pdp/quick-tips"
import FAQAccordion from "@/components/pdp/faq-accordion"
import { ProductSubstitutes } from "@/components/product-substitutes"

type DrugProduct = {
  schedule?: "OTC" | "H" | "H1" | "X"
  generic_name?: string | null
  composition?: string | null
  dosage_form?: string | null
  strength?: string | null
  gst_rate?: number | null
  mrp_paise?: number | null
  pack_size?: string | null
  indications?: string | null
  contraindications?: string | null
  side_effects?: string | null
  drug_interactions?: string | null
  dosage_instructions?: string | null
  storage_instructions?: string | null
  habit_forming?: boolean
  is_chronic?: boolean
  therapeutic_class?: string | null
}

type DrugMeta = {
  manufacturer?: string
  chemical_class?: string
  action_class?: string
  safety_advice?: Record<string, { rating: string; note: string }>
  quick_tips?: string[]
  faqs?: { q: string; a: string }[]
  references?: string[]
} | null | undefined

interface TabSectionsProps {
  drug?: DrugProduct
  meta?: DrugMeta
  productId: string
  currentPrice: number
}

type TabKey = "details" | "safety" | "clinical" | "tips" | "alternatives"

const TABS: { key: TabKey; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "safety", label: "Safety" },
  { key: "clinical", label: "Clinical Info" },
  { key: "tips", label: "Tips & FAQs" },
  { key: "alternatives", label: "Alternatives" },
]

export default function TabSections({ drug, meta, productId, currentPrice }: TabSectionsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("details")

  // Determine which tabs have content
  const hasSafety = !!meta?.safety_advice && Object.keys(meta.safety_advice).length > 0
  const hasClinical = !!(drug?.indications || drug?.side_effects || drug?.dosage_instructions || drug?.drug_interactions || drug?.contraindications)
  const hasTips = !!(meta?.quick_tips?.length || meta?.faqs?.length || meta?.references?.length)

  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === "details") return !!drug
    if (tab.key === "safety") return hasSafety
    if (tab.key === "clinical") return hasClinical
    if (tab.key === "tips") return hasTips
    if (tab.key === "alternatives") return true
    return true
  })

  if (visibleTabs.length === 0) return null

  return (
    <div className="mt-8">
      {/* Tab bar */}
      <div
        className="flex gap-0 overflow-x-auto no-scrollbar rounded-t-lg"
        style={{ borderBottom: "2px solid var(--border-primary)" }}
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative flex-shrink-0"
            style={{
              color: activeTab === tab.key ? "var(--brand-teal)" : "var(--text-secondary)",
              borderBottom: activeTab === tab.key ? "2px solid var(--brand-teal)" : "2px solid transparent",
              marginBottom: "-2px",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="py-6">
        {activeTab === "details" && drug && (
          <div className="flex flex-col gap-4">
            {/* Medicine details card */}
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-primary)" }}>
              <div className="px-4 py-3" style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-primary)" }}>
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}>
                  Medicine Details
                </h2>
              </div>
              <div className="px-4 py-4" style={{ background: "var(--bg-secondary)" }}>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {drug.generic_name && (
                    <>
                      <dt style={{ color: "var(--text-secondary)" }}>Generic name</dt>
                      <dd className="font-medium" style={{ color: "var(--text-primary)" }}>{drug.generic_name}</dd>
                    </>
                  )}
                  {drug.dosage_form && (
                    <>
                      <dt style={{ color: "var(--text-secondary)" }}>Dosage form</dt>
                      <dd className="font-medium capitalize" style={{ color: "var(--text-primary)" }}>{drug.dosage_form}</dd>
                    </>
                  )}
                  {drug.strength && (
                    <>
                      <dt style={{ color: "var(--text-secondary)" }}>Strength</dt>
                      <dd className="font-medium" style={{ color: "var(--text-primary)" }}>{drug.strength}</dd>
                    </>
                  )}
                  {drug.pack_size && (
                    <>
                      <dt style={{ color: "var(--text-secondary)" }}>Pack size</dt>
                      <dd className="font-medium capitalize" style={{ color: "var(--text-primary)" }}>{drug.pack_size}</dd>
                    </>
                  )}
                  {typeof drug.gst_rate === "number" && (
                    <>
                      <dt style={{ color: "var(--text-secondary)" }}>GST</dt>
                      <dd className="font-medium" style={{ color: "var(--text-primary)" }}>{drug.gst_rate}%</dd>
                    </>
                  )}
                  {drug.storage_instructions && (
                    <>
                      <dt style={{ color: "var(--text-secondary)" }}>Storage</dt>
                      <dd className="font-medium" style={{ color: "var(--text-primary)" }}>{drug.storage_instructions}</dd>
                    </>
                  )}
                </dl>
                {drug.composition && (
                  <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border-primary)" }}>
                    <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Composition</div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{drug.composition}</div>
                  </div>
                )}
              </div>
            </div>

            <FactBox
              chemicalClass={meta?.chemical_class}
              therapeuticClass={drug.therapeutic_class}
              actionClass={meta?.action_class}
              habitForming={drug.habit_forming}
            />
          </div>
        )}

        {activeTab === "safety" && (
          <SafetyAdvice safetyAdvice={meta?.safety_advice} />
        )}

        {activeTab === "clinical" && (
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-primary)", background: "var(--bg-secondary)" }}>
            <ExpandableSection title="Uses & Indications" content={drug?.indications} defaultOpen />
            <ExpandableSection title="Side Effects" content={drug?.side_effects} />
            <ExpandableSection title="How to Use" content={drug?.dosage_instructions} />
            <ExpandableSection title="Drug Interactions" content={drug?.drug_interactions} />
            <ExpandableSection title="Contraindications" content={drug?.contraindications} />
          </div>
        )}

        {activeTab === "tips" && (
          <div className="flex flex-col gap-4">
            <QuickTips tips={meta?.quick_tips} />
            <FAQAccordion faqs={meta?.faqs} />
            {meta?.references && meta.references.length > 0 && (
              <div className="mt-2">
                <h3 className="text-xs font-semibold mb-2" style={{ color: "var(--text-tertiary)", fontFamily: "Fraunces, Georgia, serif" }}>
                  References
                </h3>
                <ul className="flex flex-wrap gap-1.5">
                  {meta.references.map((ref, i) => (
                    <li
                      key={i}
                      className="text-[10px] px-2 py-1 rounded-full"
                      style={{ background: "var(--border-secondary)", color: "var(--text-secondary)" }}
                    >
                      {ref}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "alternatives" && (
          <ProductSubstitutes productId={productId} currentPrice={currentPrice} />
        )}
      </div>
    </div>
  )
}
