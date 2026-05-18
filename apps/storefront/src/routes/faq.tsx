import { createFileRoute } from "@tanstack/react-router"
import MedicalReviewBlock from "@/components/medical-review-block"
import { SITE_URL } from "@/lib/constants/site"

// Editorial review log for /faq. Update on every content change.
const FAQ_LAST_REVIEWED = "2026-05-16"
const FAQ_NEXT_REVIEW = "2026-11-16"

/**
 * /faq — citable Q&A page for SEO and AI answer engines.
 *
 * Why a separate page (not just merging into homepage / prescription-policy):
 *  - distinct canonical URL → independent citation target for LLMs
 *  - FAQPage JSON-LD signals Google + AI engines to extract Q&A directly
 *  - broader scope than prescription-policy (covers price, delivery, payment)
 *  - answers are short, self-contained, citation-ready (no marketing fluff)
 *
 * Every answer should be factual and standalone — LLMs lift them verbatim.
 */

const FAQS: Array<{ q: string; a: string; htmlA?: string }> = [
  {
    q: "What is a generic medicine?",
    a: "A generic medicine contains the same active ingredient, strength, dosage form, and route of administration as the original branded drug, and is therapeutically equivalent. Generics are approved by the Central Drugs Standard Control Organisation (CDSCO) under the same standards as branded drugs but typically cost 50-80% less because manufacturers do not need to recover the original research and marketing investment.",
  },
  {
    q: "Do I need a prescription to buy medicines on Suprameds?",
    a: "Schedule H and Schedule H1 drugs require a valid prescription from a Registered Medical Practitioner (RMP) before Suprameds can dispense them. Over-the-counter (OTC) medicines, vitamins, and general wellness products can be purchased without a prescription. Schedule X drugs and NDPS-controlled substances cannot be sold online in India under any circumstance.",
  },
  {
    q: "How are Schedule H and H1 prescription drugs verified at Suprameds?",
    a: "Every prescription submitted for Schedule H or H1 drugs is reviewed by our registered pharmacist Mirza Askary Ali (B.Pharm, Registration #031171/A1) before dispatch. The pharmacist verifies the prescribing doctor's medical council registration number, matches the prescribed drug to our catalog, confirms the quantity, screens for drug interactions, and records every Schedule H1 dispensing in the mandatory CDSCO H1 register. Review typically completes within 4 hours during business hours.",
  },
  {
    q: "Is delivery available in my pincode?",
    a: "Suprameds delivers to all Indian pincodes via India Post Speed Post and partner couriers. Delivery times typically range from 3-7 business days depending on location, with metro cities receiving orders fastest. Remote, hilly, and island pincodes may take longer. You can verify delivery availability for your exact pincode at checkout before placing an order.",
  },
  {
    q: "How does Suprameds offer 50-80% off MRP?",
    a: "Our prices reflect the true manufacturing cost of generic medicines without the markup that accompanies branded drugs. Many of our products are manufactured by our in-house pharmaceutical companies — Supracyn Pharma (through Betamax Remedies) and Daxia Healthcare — which eliminates intermediary distributor margins. We never sell above the printed Maximum Retail Price (MRP) and use the highest MRP across batches in a dispatched lot for full pricing transparency.",
  },
  {
    q: "Are the medicines on Suprameds genuine?",
    a: "Yes. Every medicine sold on Suprameds is sourced from CDSCO-licensed manufacturers and dispensed from our licensed pharmacy (Drug License TS/HYD/2021-82149, issued by the Telangana State Drugs Control Administration). Every order includes a cash/credit memo listing the batch number and expiry date, and we apply First-Expiry-First-Out (FEFO) allocation so customers always receive the freshest stock available.",
  },
  {
    q: "What payment methods does Suprameds accept?",
    a: "Suprameds currently accepts Cash on Delivery (COD) for all orders across India. Digital payment options via Razorpay and Paytm are configured on the platform and will be re-enabled in the storefront in a future release. There are no additional charges for choosing COD.",
  },
  {
    q: "Can I return medicines after delivery?",
    a: "Under Indian pharmacy regulations, dispensed prescription medicines cannot be returned once they leave our pharmacy because we cannot verify storage conditions after dispatch. We do accept returns for damaged, expired, or wrong items reported within 48 hours of delivery — replacements or full refunds are issued in those cases. OTC products in their original sealed packaging may be eligible for return within 7 days; please contact our helpdesk to confirm.",
  },
  {
    q: "What is the difference between Schedule H and Schedule H1 drugs?",
    a: "Both Schedule H and H1 drugs require a doctor's prescription. Schedule H covers most prescription medicines including antibiotics, antihypertensives, and antidiabetics, and allows multiple refills within 30 days. Schedule H1 covers a subset of antibiotics, anti-tuberculosis drugs, and habit-forming substances with abuse potential — these require a new prescription for every fill and the pharmacy must record each sale in a separate H1 register maintained for three years.",
  },
  {
    q: "Who is the registered pharmacist responsible for orders?",
    a: "Mirza Askary Ali, B.Pharm, is the registered pharmacist responsible for Suprameds. His registration number with the Telangana State Pharmacy Council is 031171/A1. Every prescription dispense at Suprameds is reviewed and approved by him personally, as required under the Pharmacy Act, 1948.",
  },
  {
    q: "How do I upload my prescription?",
    a: "You can upload a prescription in three ways: (1) attach a clear JPG, PNG, or PDF directly at checkout, (2) WhatsApp the prescription photo to +91 76749 62758 with your order details, or (3) email it to suprameds@gmail.com. Prescriptions older than 30 days for Schedule H or H1 drugs cannot be accepted under the Drugs & Cosmetics Act, 1940.",
  },
  {
    q: "How is my prescription data protected?",
    a: "Suprameds complies with the Digital Personal Data Protection Act, 2023 (DPDP Act). Prescription images and patient identifiers are stored encrypted at rest and accessed only by authorised pharmacy staff for dispensing and statutory record-keeping. Records are retained for five years as required by CDSCO, after which they are securely deleted. We do not sell or share patient data with third parties for marketing.",
  },
]

export const Route = createFileRoute("/faq")({
  head: () => {
    const canonical = `${SITE_URL}/faq`
    const title = "Frequently Asked Questions — Suprameds Online Pharmacy"
    const description =
      "Common questions about generic medicines, prescriptions, Schedule H verification, delivery, payment, and returns at Suprameds — India's licensed online pharmacy."

    const faqPageSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      dateModified: FAQ_LAST_REVIEWED,
      reviewedBy: {
        "@type": "Person",
        name: "Mirza Askary Ali",
        jobTitle: "Registered Pharmacist",
        identifier: "TSPC #031171/A1",
      },
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.a,
        },
      })),
    }

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "FAQ", item: canonical },
      ],
    }

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { property: "twitter:card", content: "summary_large_image" },
        { property: "twitter:title", content: title },
        { property: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(faqPageSchema) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema) },
      ],
    }
  },
  component: FAQ,
})

function FAQ() {
  return (
    <div style={{ background: "var(--bg-tertiary)", minHeight: "100vh" }}>
      <div
        style={{
          background: "var(--bg-inverse)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="content-container py-12">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--brand-teal-light)" }}
          >
            Help Center
          </p>
          <h1
            className="text-2xl lg:text-3xl font-semibold"
            style={{
              color: "var(--text-inverse)",
              fontFamily: "Fraunces, Georgia, serif",
            }}
          >
            Frequently Asked Questions
          </h1>
          <p
            className="text-sm mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Everything about generic medicines, prescriptions, delivery, and pricing at Suprameds.
          </p>
        </div>
      </div>

      <div className="content-container py-12">
        <div className="max-w-3xl flex flex-col gap-4">
          <MedicalReviewBlock
            lastReviewedAt={FAQ_LAST_REVIEWED}
            nextReviewAt={FAQ_NEXT_REVIEW}
          />
          {FAQS.map((item, idx) => (
            <details
              key={item.q}
              className="p-6 rounded-xl group"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-primary)",
              }}
              open={idx < 3}
            >
              <summary
                className="cursor-pointer list-none flex items-start justify-between gap-4"
                style={{ color: "var(--text-primary)" }}
              >
                <h2 className="text-base font-semibold flex-1">{item.q}</h2>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="flex-shrink-0 mt-1 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <p
                className="text-sm leading-relaxed mt-4"
                style={{ color: "var(--text-secondary)" }}
              >
                {item.a}
              </p>
            </details>
          ))}

          <div
            className="mt-6 p-5 rounded-xl"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <p
              className="text-sm font-semibold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Still have questions?
            </p>
            <p
              className="text-sm leading-relaxed mb-3"
              style={{ color: "var(--text-secondary)" }}
            >
              Our helpdesk is available 9 AM–9 PM, Monday to Saturday.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <a
                href="https://wa.me/917674962758?text=Hi%20Suprameds%2C%20I%20have%20a%20question"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium"
                style={{ color: "var(--brand-teal)" }}
              >
                WhatsApp +91 76749 62758
              </a>
              <span style={{ color: "var(--text-tertiary)" }}>·</span>
              <a
                href="tel:+917674962758"
                className="font-medium"
                style={{ color: "var(--brand-teal)" }}
              >
                Call +91 76749 62758
              </a>
              <span style={{ color: "var(--text-tertiary)" }}>·</span>
              <a
                href="mailto:suprameds@gmail.com"
                className="font-medium"
                style={{ color: "var(--brand-teal)" }}
              >
                suprameds@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
