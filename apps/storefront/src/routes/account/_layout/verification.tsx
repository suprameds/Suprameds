import { createFileRoute } from "@tanstack/react-router"
import { useState, useRef } from "react"
import {
  useCustomerDocuments,
  useUploadDocument,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
  type DocumentStatus,
} from "@/lib/hooks/use-documents"

export const Route = createFileRoute(
  "/account/_layout/verification"
)({
  head: () => ({
    meta: [
      { title: "Verification | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VerificationPage,
})

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "aadhaar", label: "Aadhaar Card" },
  { value: "pan", label: "PAN Card" },
  { value: "driving_license", label: "Driving License" },
  { value: "passport", label: "Passport" },
  { value: "voter_id", label: "Voter ID" },
]

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; bg: string; text: string }
> = {
  pending: {
    label: "Pending Review",
    bg: "var(--brand-amber)",
    text: "#fff",
  },
  approved: {
    label: "Approved",
    bg: "var(--brand-green)",
    text: "#fff",
  },
  rejected: {
    label: "Rejected",
    bg: "var(--brand-red)",
    text: "#fff",
  },
}

function VerificationPage() {
  const { data: documents, isLoading } = useCustomerDocuments()
  const uploadDocument = useUploadDocument()

  const [showForm, setShowForm] = useState(false)
  const [documentType, setDocumentType] = useState<DocumentType>("aadhaar")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [formError, setFormError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setFormError("File size must be less than 10MB")
      return
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]
    if (!allowedTypes.includes(file.type)) {
      setFormError("Only JPEG, PNG, WebP, and PDF files are accepted")
      return
    }

    setSelectedFile(file)
    setFormError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")

    if (!selectedFile) {
      setFormError("Please select a file to upload")
      return
    }

    try {
      // Convert file to base64
      const base64 = await fileToBase64(selectedFile)

      uploadDocument.mutate(
        {
          filename: selectedFile.name,
          content_type: selectedFile.type,
          content: base64,
          document_type: documentType,
        },
        {
          onSuccess: () => {
            setShowForm(false)
            setSelectedFile(null)
            setDocumentType("aadhaar")
            if (fileInputRef.current) fileInputRef.current.value = ""
          },
          onError: () => {
            setFormError("Upload failed. Please try again.")
          },
        }
      )
    } catch {
      setFormError("Failed to read file. Please try again.")
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setSelectedFile(null)
    setDocumentType("aadhaar")
    setFormError("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-serif font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Verification
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
            Upload ID documents for account verification
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "var(--bg-inverse)" }}
          >
            + Upload document
          </button>
        )}
      </div>

      {/* Upload form */}
      {showForm && (
        <div
          className="bg-[var(--bg-secondary)] border rounded-xl p-6"
          style={{ borderColor: "var(--brand-green)" }}
        >
          <h2
            className="text-sm font-semibold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Upload verification document
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Document type selector */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Document type *
              </label>
              <select
                value={documentType}
                onChange={(e) =>
                  setDocumentType(e.target.value as DocumentType)
                }
                className="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-offset-1 bg-[var(--bg-primary)]"
                style={{
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* File upload */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Document file *
              </label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all hover:border-[var(--brand-green)]"
                style={{ borderColor: "var(--border-primary)" }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {selectedFile ? (
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {selectedFile.name}
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <UploadIcon />
                    <p
                      className="text-sm mt-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Click to select file
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      JPEG, PNG, WebP, or PDF (max 10MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Info notice */}
            <div
              className="flex gap-2 p-3 rounded-lg text-xs"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
              }}
            >
              <InfoIcon />
              <span>
                Your document will be reviewed by our team. Sensitive information
                is stored securely and used only for verification purposes.
              </span>
            </div>

            {formError && (
              <p className="text-sm" style={{ color: "var(--brand-red)" }}>
                {formError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={uploadDocument.isPending || !selectedFile}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--bg-inverse)" }}
              >
                {uploadDocument.isPending ? "Uploading..." : "Upload document"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-gray-50"
                style={{
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Documents list */}
      {isLoading ? (
        <div
          className="bg-[var(--bg-secondary)] border rounded-xl p-8 text-center"
          style={{ borderColor: "var(--border-primary)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Loading documents...
          </p>
        </div>
      ) : !documents?.length && !showForm ? (
        <div
          className="bg-[var(--bg-secondary)] border rounded-xl p-12 text-center"
          style={{ borderColor: "var(--border-primary)" }}
        >
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
            style={{ background: "var(--bg-tertiary)" }}
          >
            <ShieldIcon size={22} />
          </div>
          <h3
            className="text-base font-semibold mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            No documents uploaded
          </h3>
          <p
            className="text-sm mb-6"
            style={{ color: "var(--text-tertiary)" }}
          >
            Upload an ID document to verify your account and enable faster
            checkout for prescription medicines.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "var(--bg-inverse)" }}
          >
            Upload document
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {documents?.map((doc) => {
            const statusCfg = STATUS_CONFIG[doc.status]
            return (
              <div
                key={doc.id}
                className="bg-[var(--bg-secondary)] border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                style={{ borderColor: "var(--border-primary)" }}
              >
                {/* Document icon */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--bg-tertiary)" }}
                >
                  <DocIcon />
                </div>

                {/* Document info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {DOCUMENT_TYPE_LABELS[doc.document_type]}
                    </p>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{
                        background: statusCfg.bg,
                        color: statusCfg.text,
                      }}
                    >
                      {statusCfg.label}
                    </span>
                  </div>
                  <p
                    className="text-xs mt-1 truncate"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {doc.original_filename}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Uploaded{" "}
                    {new Date(doc.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  {doc.status === "rejected" && doc.rejection_reason && (
                    <p
                      className="text-xs mt-2 p-2 rounded-lg"
                      style={{
                        color: "var(--brand-red)",
                        background: "#FEF2F2",
                      }}
                    >
                      Reason: {doc.rejection_reason}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data:...;base64, prefix — API expects raw base64
      const base64 = result.split(",")[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Icons ────────────────────────────────────────────────────────────

const ShieldIcon = ({ size = 15 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--text-tertiary)"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

const UploadIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--text-tertiary)"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mx-auto"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const DocIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--text-secondary)"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

const InfoIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="flex-shrink-0 mt-0.5"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)
