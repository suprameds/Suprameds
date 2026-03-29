import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/returns")({
  head: () => ({
    links: [
      { rel: "canonical", href: "https://suprameds.in/returns" },
    ],
    meta: [
      { title: "Returns & Refund Policy — Suprameds" },
      { name: "description", content: "Suprameds returns and refund policy for medicines purchased online." },
      { property: "og:title", content: "Returns & Refund Policy — Suprameds" },
      { property: "og:description", content: "Suprameds returns and refund policy for medicines purchased online." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://suprameds.in/returns" },
    ],
  }),
  component: Returns,
})

function Returns() {
  return (
    <div style={{ background: "var(--bg-tertiary)", minHeight: "100vh" }}>
      <div style={{ background: "var(--bg-inverse)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="content-container py-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--brand-teal-light)" }}>Legal</p>
          <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-inverse)", fontFamily: "Fraunces, Georgia, serif" }}>
            Returns &amp; Refund Policy
          </h1>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Last updated: March 2025
          </p>
        </div>
      </div>

      <div className="content-container py-12">
        <div className="max-w-3xl flex flex-col gap-6">

          <div className="p-5 rounded-xl" style={{ background: "#fdebd0", border: "1px solid var(--brand-amber)" }}>
            <p className="text-sm font-medium" style={{ color: "#7D6608" }}>
              Due to the nature of pharmaceutical products and patient safety requirements, our return window is 48 hours from delivery and is limited to specific circumstances. Opened or partially consumed medicines cannot be returned under any circumstances.
            </p>
          </div>

          {[
            {
              title: "Eligible return reasons",
              content: `Returns are accepted within 48 hours of delivery for:
              <ul class="mt-2 space-y-1.5">
                <li>Wrong product delivered (different from what was ordered)</li>
                <li>Physically damaged product on arrival (with photo evidence required)</li>
                <li>Product part of a manufacturer recall (Suprameds will initiate proactively)</li>
                <li>Product near expiry on arrival (less than 30 days remaining)</li>
              </ul>`,
            },
            {
              title: "Non-eligible returns",
              content: `We cannot accept returns for:
              <ul class="mt-2 space-y-1.5">
                <li>Opened, partially used, or tampered medicines</li>
                <li>Medicines returned more than 48 hours after delivery</li>
                <li>Changed of mind (medicine safety regulation does not permit resale)</li>
                <li>Prescription medicines where the prescription was later found to be inappropriate by your doctor</li>
                <li>Products with removed or defaced labels</li>
              </ul>`,
            },
            {
              title: "How to initiate a return",
              content: `
              <ol class="mt-2 space-y-2">
                <li>1. Contact us within 48 hours of delivery via WhatsApp (+91 76749 62758) or email suprameds@gmail.in</li>
                <li>2. Provide your order number and a clear photo of the product showing the issue</li>
                <li>3. Our support team will raise a return request and arrange pickup</li>
                <li>4. Our pharmacist inspects the returned product</li>
                <li>5. Refund processed within 5–7 business days after inspection</li>
              </ol>`,
            },
            {
              title: "Refund methods",
              content: `Refunds are processed to the original payment method:
              <ul class="mt-2 space-y-1.5">
                <li><strong>UPI/Cards/Netbanking:</strong> 5–7 business days to original account</li>
                <li><strong>COD orders:</strong> Bank transfer (NEFT) — we will request your bank details</li>
                <li><strong>Store credit / loyalty points:</strong> Available as an alternative, credited within 24 hours</li>
              </ul>`,
            },
            {
              title: "Pharmacy recall policy",
              content: `If a product you purchased is subject to a manufacturer or CDSCO recall, Suprameds will: (1) contact you via SMS, WhatsApp, and email; (2) arrange free pickup of the recalled product; (3) issue a full refund within 48 hours of pickup confirmation. We maintain complete batch-level traceability for this purpose.`,
            },
          ].map((section) => (
            <div key={section.title} className="p-6 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
              <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{section.title}</h2>
              <div className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }} dangerouslySetInnerHTML={{ __html: section.content }} />
            </div>
          ))}

          <div className="p-5 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Need help?</h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Contact us: <a href="tel:+917674962758" className="font-medium" style={{ color: "var(--brand-teal)" }}>+91 76749 62758</a> or email <a href="mailto:suprameds@gmail.in" className="font-medium" style={{ color: "var(--brand-teal)" }}>suprameds@gmail.in</a>
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>9 AM – 9 PM · Monday to Saturday</p>
          </div>
        </div>
      </div>
    </div>
  )
}
