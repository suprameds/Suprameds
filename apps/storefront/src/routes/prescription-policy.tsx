import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/prescription-policy")({
  head: () => ({
    meta: [
      { title: "Prescription Policy — Suprameds" },
      { name: "description", content: "Suprameds prescription policy: how we accept, verify, and dispense prescription medicines as required by Indian pharmacy law." },
    ],
  }),
  component: PrescriptionPolicy,
})

function PrescriptionPolicy() {
  return (
    <div style={{ background: "#F8F6F2", minHeight: "100vh" }}>
      <div style={{ background: "#0D1B2A", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="content-container py-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#16a5b0" }}>Legal</p>
          <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "#fff", fontFamily: "Fraunces, Georgia, serif" }}>
            Prescription Policy
          </h1>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            In compliance with the Drugs &amp; Cosmetics Act, 1940 and Pharmacy Act, 1948 · Last updated March 2025
          </p>
        </div>
      </div>

      <div className="content-container py-12">
        <div className="max-w-3xl flex flex-col gap-8">

          <div className="p-5 rounded-xl" style={{ background: "#fdebd0", border: "1px solid #D68910" }}>
            <div className="flex items-start gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D68910" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "#7D6608" }}>Important Notice</p>
                <p className="text-sm" style={{ color: "#7D6608" }}>
                  Under the Drugs &amp; Cosmetics Act, 1940, Schedule H and H1 drugs can only be dispensed against a valid prescription from a Registered Medical Practitioner (RMP). Schedule X and NDPS drugs cannot be sold online under any circumstances.
                </p>
              </div>
            </div>
          </div>

          {[
            {
              title: "Which medicines require a prescription?",
              content: `
                <p>The following drug schedules require a valid prescription at Suprameds:</p>
                <ul class="mt-3 space-y-2">
                  <li><strong>Schedule H drugs</strong> — Prescription mandatory. Valid for 30 days from prescription date. Examples: antibiotics, antihypertensives, antidiabetics.</li>
                  <li><strong>Schedule H1 drugs</strong> — Prescription mandatory. Valid for 30 days. One fill only. Every dispense entered in CDSCO H1 register. Examples: certain antibiotics with abuse potential.</li>
                  <li><strong>Schedule X drugs</strong> — <span style="color:#C0392B;font-weight:600;">Not available online.</span> Absolute prohibition under Indian law.</li>
                  <li><strong>NDPS substances</strong> — <span style="color:#C0392B;font-weight:600;">Not available online.</span> Governed by NDPS Act, 1985.</li>
                </ul>
              `,
            },
            {
              title: "What is a valid prescription?",
              content: `
                <p>A valid prescription must contain:</p>
                <ul class="mt-3 space-y-2">
                  <li>Patient's full name and age</li>
                  <li>Doctor's full name and registration number (MCI / State Medical Council)</li>
                  <li>Hospital/clinic name and address</li>
                  <li>Date of prescription</li>
                  <li>Drug name, dosage, frequency, and duration</li>
                  <li>Doctor's signature</li>
                </ul>
                <p class="mt-3">Prescriptions older than 30 days for Schedule H/H1 drugs will not be accepted.</p>
              `,
            },
            {
              title: "How to upload your prescription",
              content: `
                <p>You can submit prescriptions in any of the following ways:</p>
                <ul class="mt-3 space-y-2">
                  <li>Upload a clear photo (JPG/PNG) or PDF at checkout</li>
                  <li>WhatsApp the prescription photo to +91 800 800 1234 with your order details</li>
                  <li>Email to prescriptions@suprameds.in</li>
                </ul>
                <p class="mt-3">Our registered pharmacist reviews all prescriptions within 4 hours during business hours (9 AM–9 PM, Mon–Sat).</p>
              `,
            },
            {
              title: "Pharmacist review process",
              content: `
                <p>Once your prescription is received, our registered pharmacist (RPh B. Venkat Kumar, Reg. #KA/2019/4821) will:</p>
                <ul class="mt-3 space-y-2">
                  <li>Verify the prescribing doctor's registration number</li>
                  <li>Map the prescribed drug to our catalog item</li>
                  <li>Approve the quantity as written (no quantity increases)</li>
                  <li>Flag any drug interaction concerns and contact you if needed</li>
                  <li>For Schedule H1: write the mandatory CDSCO H1 register entry in the same transaction</li>
                </ul>
                <p class="mt-3">You will receive SMS and WhatsApp updates at each stage of the review.</p>
              `,
            },
            {
              title: "Prescription validity and refills",
              content: `
                <ul class="space-y-2">
                  <li><strong>Schedule H:</strong> Valid 30 days from prescription date. Multiple refills allowed within the fill period if quantity supports it.</li>
                  <li><strong>Schedule H1:</strong> Valid 30 days. One fill only — refills require a new prescription.</li>
                  <li><strong>OTC with doctor prescription:</strong> Valid 90 days. Multiple refills allowed.</li>
                </ul>
                <p class="mt-3">Prescriptions are stored securely on our servers for 5 years as required by CDSCO regulations. Access is restricted to authorised pharmacy staff only.</p>
              `,
            },
            {
              title: "Why we cannot dispense without a valid prescription",
              content: `
                <p>Dispensing Schedule H or H1 drugs without a valid prescription from a Registered Medical Practitioner is a criminal offence under the Drugs &amp; Cosmetics Act, 1940. Our pharmacist is legally obligated to refuse dispensing if the prescription is invalid, expired, or suspicious. There are no exceptions to this rule — not even for repeat customers or emergencies.</p>
                <p class="mt-3">If you need emergency medication, please visit your nearest government hospital or call 112.</p>
              `,
            },
          ].map((section) => (
            <div key={section.title} className="p-6 rounded-xl" style={{ background: "#fff", border: "1px solid #EDE9E1" }}>
              <h2 className="text-base font-semibold mb-4" style={{ color: "#0D1B2A" }}>{section.title}</h2>
              <div
                className="text-sm leading-relaxed"
                style={{ color: "#555" }}
                dangerouslySetInnerHTML={{ __html: section.content }}
              />
            </div>
          ))}

          <div className="text-xs" style={{ color: "#aaa" }}>
            <p>For questions about this policy, contact our pharmacist helpline at +91 800 800 1234 (9 AM–9 PM, Mon–Sat) or WhatsApp us.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
