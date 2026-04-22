import { createFileRoute } from "@tanstack/react-router"
import { SITE_URL } from "@/lib/constants/site"

export const Route = createFileRoute("/privacy")({
  head: () => ({
    links: [
      { rel: "canonical", href: `${SITE_URL}/privacy` },
    ],
    meta: [
      { title: "Privacy Policy — Suprameds" },
      { name: "description", content: "Suprameds privacy policy under the Digital Personal Data Protection (DPDP) Act, 2023. Your data rights and how we protect your health information." },
      { property: "og:title", content: "Privacy Policy — Suprameds" },
      { property: "og:description", content: "Suprameds privacy policy under the Digital Personal Data Protection (DPDP) Act, 2023. Your data rights and how we protect your health information." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/privacy` },
    ],
  }),
  component: PrivacyPolicy,
})

function PrivacyPolicy() {
  return (
    <div style={{ background: "var(--bg-tertiary)", minHeight: "100vh" }}>
      <div style={{ background: "var(--bg-inverse)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="content-container py-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--brand-teal-light)" }}>Legal</p>
          <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-inverse)", fontFamily: "Fraunces, Georgia, serif" }}>
            Privacy Policy
          </h1>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Digital Personal Data Protection (DPDP) Act, 2023 · IT Act, 2000 · Last updated: April 2026 · Version 3.0
          </p>
        </div>
      </div>

      <div className="content-container py-12">
        <div className="max-w-3xl flex flex-col gap-6">

          <div className="p-5 rounded-xl" style={{ background: "#d5f0e2", border: "1px solid var(--price-color)" }}>
            <p className="text-sm font-medium" style={{ color: "#0f4a2b" }}>
              Suprameds is committed to protecting your personal and health data under the DPDP Act, 2023.
              All sensitive personal data (prescriptions, health records) is stored in data centres in India and never exported.
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
                <li><strong>Location data:</strong> Approximate and precise location (with your permission) — used solely to check delivery availability for your pincode and pre-fill address fields. Never used for tracking or advertising.</li>
                <li><strong>Camera &amp; photos:</strong> Camera access and photo library access are requested only when you upload a prescription. Images are uploaded directly to our encrypted prescription store; we do not access your gallery otherwise.</li>
                <li><strong>Device identifiers:</strong> Firebase Cloud Messaging (FCM) push token for notifications, Google advertising ID for ad-conversion measurement, IP address for fraud prevention and security</li>
                <li><strong>Usage data:</strong> Pages visited, search queries, product interactions (non-PHI pages only, with your analytics consent)</li>
              </ul>`,
            },
            {
              title: "2. Legal basis for processing",
              content: `We process your data under the following lawful bases:
              <ul class="mt-2 space-y-1.5">
                <li><strong>Consent:</strong> Health data, analytics, marketing communications</li>
                <li><strong>Contract performance:</strong> Processing your orders and prescription dispensing</li>
                <li><strong>Legal obligation:</strong> CDSCO prescription retention, GST records retention, H1 register — as required by applicable law</li>
                <li><strong>Legitimate interest:</strong> Fraud prevention, security logs, poison control emergency situations</li>
              </ul>`,
            },
            {
              title: "3. Data storage and security",
              content: `All sensitive personal data (prescriptions, health records) is stored in data centres in the India region, complying with the DPDP Act's data localisation requirement.
              <ul class="mt-2 space-y-1.5">
                <li>Prescription documents: Encrypted at rest on Cloudflare R2 (India region), TLS in transit</li>
                <li>Account &amp; order databases: Hosted on Supabase (Mumbai, India region)</li>
                <li>Health records: Encrypted, access-logged, accessible only to authorised pharmacists</li>
                <li>Backups: Regular backups with appropriate retention; PHI records retained as required by CDSCO</li>
                <li>Access control: Role-based, with multi-factor authentication for staff access</li>
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
              <p class="mt-3">To exercise these rights, email <a href="mailto:suprameds@gmail.com" style="color:var(--brand-teal)">suprameds@gmail.com</a> or call +91 76749 62758. We respond within 15 days as required by DPDP Rules.</p>`,
            },
            {
              title: "5. Data sharing with third-party processors",
              content: `We never sell your personal data. We share the minimum necessary data only with the following categories of processors, each bound by a data-processing agreement:
              <ul class="mt-2 space-y-1.5">
                <li><strong>Logistics carriers (via AfterShip):</strong> Delivery address, phone number, order contents for last-mile shipment and tracking</li>
                <li><strong>Payment processors (Razorpay, Paytm):</strong> Transaction amount and order reference only — card and UPI details are entered directly into the processor's PCI-DSS-certified interface; we never see or store them. Cash-on-delivery transactions do not leave our systems.</li>
                <li><strong>SMS providers (BulkSMSPlans.com primary, MSG91 fallback):</strong> Phone number + transactional OTP and order-status templates only. DLT-registered sender IDs (SUPRACYN PRIVATE LIMITED).</li>
                <li><strong>Email provider (Resend):</strong> Email address + order-related transactional message content</li>
                <li><strong>Push notifications (Firebase Cloud Messaging, a Google service):</strong> Device token + notification payload. FCM may transfer data outside India per Google's standard terms.</li>
                <li><strong>Analytics (Firebase Analytics, Google Analytics 4, Google Tag Manager):</strong> Anonymous usage data. Does not include PHI. Requires your analytics consent.</li>
                <li><strong>Google Ads conversion tracking:</strong> When you enable marketing consent, we send SHA-256 hashes of your email and phone (Enhanced Conversions) to Google Ads for cross-device attribution. Hashed values cannot be reversed to the original email/phone. Opt out by disabling marketing consent.</li>
                <li><strong>Error monitoring (Sentry):</strong> Technical error traces. Sensitive fields are scrubbed before transmission.</li>
                <li><strong>Regulatory authorities (CDSCO, State Drug Controller):</strong> Prescription and dispensing records on regulatory inspection</li>
                <li><strong>Law enforcement:</strong> When legally required by court order</li>
              </ul>
              <p class="mt-3"><strong>International transfers:</strong> Google and Sentry may process analytics/error data outside India. No sensitive PHI (prescriptions, health records, dispensing details) is ever transferred outside India.</p>`,
            },
            {
              title: "6. Cookies &amp; mobile app permissions",
              content: `On the web, we use the following categories of cookies:
              <ul class="mt-2 space-y-1.5">
                <li><strong>Essential:</strong> Session, cart, OTP authentication — always active (legitimate interest)</li>
                <li><strong>Functional:</strong> Order history, saved addresses, recently viewed — requires consent</li>
                <li><strong>Analytics:</strong> Page view analytics on non-PHI pages — requires consent, off by default</li>
                <li><strong>Marketing:</strong> Abandoned cart, WhatsApp marketing — requires explicit consent, off by default</li>
              </ul>
              <p class="mt-3">In our Android application (package <code>in.supracyn.app</code>), we request the following runtime permissions only at the moment they are needed:</p>
              <ul class="mt-2 space-y-1.5">
                <li><strong>Camera:</strong> Prompted when you choose "Take photo" to capture a prescription. Never used in the background.</li>
                <li><strong>Photos &amp; media:</strong> Prompted when you choose "Upload from gallery" to attach a prescription image. We only read the specific image you select.</li>
                <li><strong>Location (coarse/precise):</strong> Prompted when you tap "Use my location" to auto-detect your pincode. You can always enter your pincode manually instead.</li>
                <li><strong>Notifications (Android 13+):</strong> Prompted for order and prescription-review status updates via Firebase Cloud Messaging. You can revoke at any time in Android Settings → Apps.</li>
              </ul>
              <p class="mt-3">To manage your preferences or withdraw consent, email <a href="mailto:suprameds@gmail.com" style="color:var(--brand-teal)">suprameds@gmail.com</a>.</p>`,
            },
            {
              title: "7. Data retention",
              content: `We retain data for the periods required by applicable law:
              <ul class="mt-2 space-y-1.5">
                <li>Prescription documents: as required by CDSCO regulations</li>
                <li>Supply memos and GST invoices: as required by GST Act</li>
                <li>H1 register entries: as required by Drugs &amp; Cosmetics Rules</li>
                <li>Order history: as required for service and legal obligations</li>
                <li>PHI access logs: as required by applicable regulations</li>
                <li>Account data: until account deletion request (subject to legal holds)</li>
                <li>Analytics events (non-PHI): limited retention period</li>
              </ul>`,
            },
            {
              title: "8. Contact &amp; Grievance Officer",
              content: `For privacy queries, data-rights requests, or to withdraw consent:
              <ul class="mt-2 space-y-1.5">
                <li><strong>Data Protection / Grievance Officer:</strong> Supracyn Private Limited</li>
                <li>Email: <a href="mailto:suprameds@gmail.com" style="color:var(--brand-teal)">suprameds@gmail.com</a></li>
                <li>Grievance escalation: <a href="mailto:suprameds@gmail.com" style="color:var(--brand-teal)">suprameds@gmail.com</a> (response within 15 days per DPDP Rules)</li>
                <li>Helpdesk: <a href="mailto:suprameds@gmail.com" style="color:var(--brand-teal)">suprameds@gmail.com</a></li>
                <li>Phone: +91 76749 62758</li>
                <li>Address: Supracyn Private Limited, 1st Floor, H.No 7-2-544, SRT 323, Sanathnagar, Hyderabad – 500018, Telangana, India</li>
                <li>For unresolved DPDP Act complaints: Data Protection Board of India (once operational)</li>
              </ul>`,
            },
          ].map((section) => (
            <div key={section.title} className="p-6 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
              <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{section.title}</h2>
              <div
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
                dangerouslySetInnerHTML={{ __html: section.content }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
