import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/terms")({
  head: () => ({
    links: [
      { rel: "canonical", href: "https://suprameds.in/terms" },
    ],
    meta: [
      { title: "Terms of Service — Suprameds" },
      { name: "description", content: "Terms of service for Suprameds, India's licensed online pharmacy. Covers eligibility, prescription medicines, pricing, delivery, returns, and legal information." },
      { property: "og:title", content: "Terms of Service — Suprameds" },
      { property: "og:description", content: "Terms of service for Suprameds, India's licensed online pharmacy. Covers eligibility, prescription medicines, pricing, delivery, returns, and legal information." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://suprameds.in/terms" },
    ],
  }),
  component: Terms,
})

function Terms() {
  return (
    <div style={{ background: "var(--bg-tertiary)", minHeight: "100vh" }}>
      <div style={{ background: "var(--bg-inverse)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="content-container py-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--brand-teal-light)" }}>Legal</p>
          <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-inverse)", fontFamily: "Fraunces, Georgia, serif" }}>
            Terms of Service
          </h1>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Last updated: March 2025
          </p>
        </div>
      </div>

      <div className="content-container py-12">
        <div className="max-w-3xl flex flex-col gap-6">
          {[
            {
              title: "1. Platform and Legal Status",
              content: `Suprameds.in is operated by Supracyn Pharma Pvt Ltd, a licensed online pharmacy registered under the Drugs &amp; Cosmetics Act 1940, holding Drug License No. TS/HYD/2021-82149 (Form 20 &amp; 21). By using this platform, you agree to these terms.`,
            },
            {
              title: "2. Eligibility",
              content: `You must be 18 years or older to create an account and purchase medicines. Prescription medicines can only be purchased with a valid prescription from a Registered Medical Practitioner. You warrant that all information you provide, including prescription documents, is accurate and genuine.`,
            },
            {
              title: "3. Prohibited Conduct",
              content: `You may not: (a) provide fraudulent or forged prescriptions; (b) attempt to purchase Schedule X or NDPS substances through this platform; (c) misrepresent your identity or health conditions; (d) use this platform for commercial resale of medicines; (e) interfere with the platform's security or operation. Violation of these terms may result in account termination and reporting to relevant authorities.`,
            },
            {
              title: "4. Prescription Medicines",
              content: `All Schedule H and H1 medicines require a valid prescription. We reserve the right to refuse any order where the prescription is invalid, expired, or suspicious. Dispensing decisions are made solely by our registered pharmacist and cannot be appealed by the customer on medical grounds. If you disagree with a dispensing decision, please consult your doctor.`,
            },
            {
              title: "5. Pricing and Payment",
              content: `All prices are in INR and inclusive of applicable GST. The MRP displayed is the maximum legal retail price under the Drug Price Control Order. We do not charge above MRP. COD orders include a transparent surcharge shown before confirmation. Payment is processed by Paytm — we do not store card details.`,
            },
            {
              title: "6. Delivery",
              content: `We ship via India Post Speed Post to all serviceable pincodes across India. Estimated delivery times are shown at checkout and are not guaranteed. Suprameds is not liable for delays caused by India Post, natural disasters, or events beyond our control. OTP confirmation is required for Rx order delivery.`,
            },
            {
              title: "7. Returns and Refunds",
              content: `Medicines are eligible for return within 48 hours of delivery only if: (a) wrong product delivered; (b) damaged product; (c) recalled product; (d) product near expiry on arrival. Opened or partially consumed medicines cannot be returned. Refunds are processed to the original payment method within 5–7 business days after inspection.`,
            },
            {
              title: "8. Limitation of Liability",
              content: `Suprameds is a licensed pharmacy platform. We are not a substitute for professional medical advice. Always consult your doctor before taking any medicine. To the maximum extent permitted by law, our liability is limited to the value of the order placed. We are not liable for adverse reactions to medicines when dispensed against a valid prescription.`,
            },
            {
              title: "9. Governing Law",
              content: `These terms are governed by the laws of India. Any dispute shall be subject to the exclusive jurisdiction of courts in Hyderabad, Telangana. For consumer disputes, you may also approach the National Consumer Helpline at 1800-11-4000.`,
            },
            {
              title: "10. Changes to Terms",
              content: `We may update these terms periodically. Continued use of the platform after notification of changes constitutes acceptance. Major changes will be notified via email.`,
            },
          ].map((section) => (
            <div key={section.title} className="p-6 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
              <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{section.title}</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }} dangerouslySetInnerHTML={{ __html: section.content }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
