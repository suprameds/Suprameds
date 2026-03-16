import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Suprameds" },
      { name: "description", content: "Suprameds privacy policy under the Digital Personal Data Protection (DPDP) Act, 2023. Your data rights and how we protect your health information." },
    ],
  }),
  component: PrivacyPolicy,
})

function PrivacyPolicy() {
  return (
    <div style={{ background: "#F8F6F2", minHeight: "100vh" }}>
      <div style={{ background: "#0D1B2A", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="content-container py-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#16a5b0" }}>Legal</p>
          <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "#fff", fontFamily: "Fraunces, Georgia, serif" }}>
            Privacy Policy
          </h1>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Digital Personal Data Protection (DPDP) Act, 2023 · IT Act, 2000 · Last updated: March 2025 · Version 2.1
          </p>
        </div>
      </div>

      <div className="content-container py-12">
        <div className="max-w-3xl flex flex-col gap-6">

          <div className="p-5 rounded-xl" style={{ background: "#d5f0e2", border: "1px solid #1A7A4A" }}>
            <p className="text-sm font-medium" style={{ color: "#0f4a2b" }}>
              Suprameds is committed to protecting your personal and health data under the DPDP Act, 2023.
              All sensitive personal data (prescriptions, health records) is stored in India (ap-south-1) and never exported.
              You have the right to access, correct, and erase your data at any time.
            </p>
          </div>

          {[
            {
              title: "1. What data we collect",
              content: `We collect the following categories of personal data with your explicit consent:
              <ul class="mt-2 space-y-1.5">
                <li><strong>Account data:</strong> Name, phone, email, date of birth</li>
                <li><strong>Health data (PHI):</strong> Prescription documents, prescribing doctor details, dispensed medicines, family member health information</li>
                <li><strong>Transaction data:</strong> Order history, payment method (not card numbers), delivery addresses</li>
                <li><strong>Usage data:</strong> Pages visited, search queries (non-PHI pages only, with your analytics consent)</li>
                <li><strong>Device data:</strong> IP address, browser type (for fraud prevention — legitimate interest basis)</li>
              </ul>`,
            },
            {
              title: "2. Legal basis for processing",
              content: `We process your data under the following lawful bases:
              <ul class="mt-2 space-y-1.5">
                <li><strong>Consent:</strong> Health data, analytics, marketing communications</li>
                <li><strong>Contract performance:</strong> Processing your orders and prescription dispensing</li>
                <li><strong>Legal obligation:</strong> CDSCO 5-year prescription retention, GST records retention 7 years, H1 register</li>
                <li><strong>Legitimate interest:</strong> Fraud prevention, security logs, poison control emergency situations</li>
              </ul>`,
            },
            {
              title: "3. Data storage and security",
              content: `All personal data is stored in AWS Mumbai (ap-south-1) data centres, complying with the DPDP Act's data localisation requirement for sensitive personal data.
              <ul class="mt-2 space-y-1.5">
                <li>Prescription documents: AES-256 encrypted at rest, stored only in India</li>
                <li>Health records: Encrypted, access-logged, accessible only to authorised pharmacists</li>
                <li>Backups: Daily, retained for 35 days; PHI records retained as required by CDSCO (5 years minimum)</li>
                <li>Access control: Role-based, with TOTP 2FA for all clinical staff</li>
                <li>Breach notification: You will be notified within 72 hours of any data breach affecting your account</li>
              </ul>`,
            },
            {
              title: "4. Your rights under DPDP Act, 2023",
              content: `As a Data Principal, you have the following rights:
              <ul class="mt-2 space-y-1.5">
                <li><strong>Right to access:</strong> Request a copy of all your personal data</li>
                <li><strong>Right to correction:</strong> Correct inaccurate personal data</li>
                <li><strong>Right to erasure:</strong> Request deletion of your data (subject to legal retention obligations)</li>
                <li><strong>Right to withdraw consent:</strong> Withdraw any consent given for non-essential processing</li>
                <li><strong>Right to grievance:</strong> Raise complaints with our Grievance Officer (see /grievance)</li>
                <li><strong>Right to nominate:</strong> Nominate a person to exercise rights on your behalf</li>
              </ul>
              <p class="mt-3">To exercise these rights, visit <a href="/account/privacy" style="color:#0E7C86">Account → Privacy Settings</a> or email privacy@suprameds.in.</p>`,
            },
            {
              title: "5. Data sharing",
              content: `We never sell your personal data. We share data only as follows:
              <ul class="mt-2 space-y-1.5">
                <li><strong>India Post:</strong> Delivery address and phone number for shipment</li>
                <li><strong>Payment processors (Razorpay/Stripe):</strong> Transaction data only. We never store card numbers.</li>
                <li><strong>MSG91/Twilio:</strong> Phone number for transactional SMS/WhatsApp only</li>
                <li><strong>CDSCO inspectors:</strong> Prescription and dispensing records on court order or regulatory inspection</li>
                <li><strong>Law enforcement:</strong> When legally required by court order</li>
              </ul>`,
            },
            {
              title: "6. Cookies",
              content: `We use the following categories of cookies:
              <ul class="mt-2 space-y-1.5">
                <li><strong>Essential:</strong> Session, cart, OTP authentication — always active (legitimate interest)</li>
                <li><strong>Functional:</strong> Order history, saved addresses, recently viewed — requires consent</li>
                <li><strong>Analytics:</strong> PostHog page view analytics on non-PHI pages — requires consent, off by default</li>
                <li><strong>Marketing:</strong> Abandoned cart, WhatsApp marketing — requires explicit consent, off by default</li>
              </ul>
              <p class="mt-3">Manage your consent at any time: <a href="/account/privacy" style="color:#0E7C86">Account → Privacy Settings</a></p>`,
            },
            {
              title: "7. Data retention",
              content: `We retain data for the following periods:
              <ul class="mt-2 space-y-1.5">
                <li>Prescription documents: 5 years (CDSCO mandatory)</li>
                <li>Supply memos and GST invoices: 7 years (GST Act)</li>
                <li>H1 register entries: 5 years (Drugs &amp; Cosmetics Rules)</li>
                <li>Order history: 5 years</li>
                <li>PHI access logs: 5 years</li>
                <li>Account data: Until account deletion request (subject to legal holds)</li>
                <li>Analytics events (non-PHI): 1 year</li>
              </ul>`,
            },
            {
              title: "8. Contact",
              content: `For privacy queries or to exercise your rights:
              <ul class="mt-2 space-y-1.5">
                <li>Email: privacy@suprameds.in</li>
                <li>Grievance Officer: Priya Sharma · grievance@suprameds.in</li>
                <li>Phone: +91 800 800 5678</li>
                <li>Address: Suprameds Pharma Pvt. Ltd., #42 Industrial Area Phase 2, Hyderabad, Telangana 500072</li>
                <li>For DPDP Act complaints: Data Protection Board of India (once operational)</li>
              </ul>`,
            },
          ].map((section) => (
            <div key={section.title} className="p-6 rounded-xl" style={{ background: "#fff", border: "1px solid #EDE9E1" }}>
              <h2 className="text-base font-semibold mb-3" style={{ color: "#0D1B2A" }}>{section.title}</h2>
              <div
                className="text-sm leading-relaxed"
                style={{ color: "#555" }}
                dangerouslySetInnerHTML={{ __html: section.content }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
