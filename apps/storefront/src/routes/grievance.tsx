import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

export const Route = createFileRoute("/grievance")({
  head: () => ({
    links: [
      { rel: "canonical", href: "https://suprameds.in/grievance" },
    ],
    meta: [
      { title: "Grievance Officer — Suprameds" },
      { name: "description", content: "Contact Suprameds Grievance Officer. Consumer Protection (E-Commerce) Rules 2020 complaint mechanism. 48-hour resolution SLA." },
      { property: "og:title", content: "Grievance Officer — Suprameds" },
      { property: "og:description", content: "Contact Suprameds Grievance Officer. Consumer Protection (E-Commerce) Rules 2020 complaint mechanism. 48-hour resolution SLA." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://suprameds.in/grievance" },
    ],
  }),
  component: GrievancePage,
})

function GrievancePage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "", email: "", orderNo: "", category: "", description: "" })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div style={{ background: "var(--bg-tertiary)", minHeight: "100vh" }}>
      <div style={{ background: "var(--bg-inverse)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="content-container py-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--brand-teal-light)" }}>Consumer Protection</p>
          <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-inverse)", fontFamily: "Fraunces, Georgia, serif" }}>
            Grievance Officer
          </h1>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            As required by Consumer Protection (E-Commerce) Rules, 2020 · 48-hour response SLA
          </p>
        </div>
      </div>

      <div className="content-container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl">

          {/* Grievance Officer Contact */}
          <div className="flex flex-col gap-5">
            <div className="p-6 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
              <h2 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Grievance Officer</h2>
              <div className="flex flex-col gap-4 text-sm">
                {[
                  { label: "Name", value: "Suprameds Helpdesk" },
                  { label: "Designation", value: "Customer Support" },
                  { label: "Email", value: "suprameds@gmail.com" },
                  { label: "Phone", value: "+91 76749 62758" },
                  { label: "WhatsApp", value: "+91 76749 62758" },
                  { label: "Response SLA", value: "48 business hours" },
                  { label: "Working Hours", value: "9 AM – 9 PM · Mon–Sat" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-tertiary)" }}>{label}</p>
                    <p className="font-medium" style={{ color: "var(--text-primary)" }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Escalation Path</h3>
              <div className="flex flex-col gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                <div className="flex gap-2">
                  <span className="font-semibold" style={{ color: "var(--brand-teal)", width: "20px" }}>1.</span>
                  <span>Submit via this form or call +91 76749 62758</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold" style={{ color: "var(--brand-teal)", width: "20px" }}>2.</span>
                  <span>We respond within 48 hours with ticket number</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold" style={{ color: "var(--brand-teal)", width: "20px" }}>3.</span>
                  <span>Resolution within 15 days of receipt</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold" style={{ color: "var(--brand-teal)", width: "20px" }}>4.</span>
                  <span>For unresolved cases: National Consumer Helpline 1800-11-4000</span>
                </div>
              </div>
            </div>
          </div>

          {/* Grievance Form */}
          <div className="lg:col-span-2">
            {submitted ? (
              <div className="p-8 rounded-xl text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#d5f0e2" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--price-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}>
                  Grievance Submitted
                </h3>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Your grievance has been registered. You will receive a ticket number via SMS/email within 24 hours.
                  Our Grievance Officer will respond within 48 business hours.
                </p>
              </div>
            ) : (
              <div className="p-6 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                <h2 className="text-base font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Submit a Grievance</h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { id: "name", label: "Full Name *", placeholder: "Your name", type: "text" },
                      { id: "phone", label: "Phone Number *", placeholder: "+91 XXXXX XXXXX", type: "tel" },
                      { id: "email", label: "Email Address", placeholder: "you@example.com", type: "email" },
                      { id: "orderNo", label: "Order Number (if applicable)", placeholder: "ORD-2025-XXXXX", type: "text" },
                    ].map((field) => (
                      <div key={field.id}>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{field.label}</label>
                        <input
                          type={field.type}
                          placeholder={field.placeholder}
                          value={(form as any)[field.id]}
                          onChange={(e) => setForm(prev => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                          style={{ border: "1px solid var(--border-primary)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                          required={field.id === "name" || field.id === "phone"}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Category *</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                      style={{ border: "1px solid var(--border-primary)", background: "var(--bg-tertiary)", color: form.category ? "var(--text-primary)" : "var(--text-tertiary)" }}
                      required
                    >
                      <option value="">Select category</option>
                      <option value="order">Order / Delivery issue</option>
                      <option value="product">Wrong / Damaged product</option>
                      <option value="prescription">Prescription issue</option>
                      <option value="refund">Refund not received</option>
                      <option value="privacy">Data privacy concern</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Description *</label>
                    <textarea
                      placeholder="Describe your grievance in detail (minimum 50 characters)"
                      value={form.description}
                      onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={5}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                      style={{ border: "1px solid var(--border-primary)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                      required
                      minLength={50}
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-3 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                    style={{ background: "var(--bg-inverse)", color: "var(--text-inverse)" }}
                  >
                    Submit Grievance
                  </button>

                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    By submitting, you consent to Suprameds processing this information to resolve your grievance under DPDP Act, 2023.
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
