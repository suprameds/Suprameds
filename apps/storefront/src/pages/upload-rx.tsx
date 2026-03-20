import { useCustomer } from "@/lib/hooks/use-customer"
import { Link, useLoaderData } from "@tanstack/react-router"
import { useCallback, useRef, useState } from "react"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

type UploadState = "idle" | "selected" | "uploading" | "success" | "error"

const UploadIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const CheckCircleIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1A7A4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
)

const FileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const UploadRx = () => {
  const { countryCode } = useLoaderData({ from: "/$countryCode/upload-rx" })
  const { data: customer } = useCustomer()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [state, setState] = useState<UploadState>("idle")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [dragOver, setDragOver] = useState(false)

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Please upload a JPG, PNG, WebP image or PDF file."
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size must be under 10 MB."
    }
    return null
  }, [])

  const handleFileSelect = useCallback(
    (file: File) => {
      const error = validateFile(file)
      if (error) {
        setErrorMsg(error)
        setState("error")
        return
      }
      setSelectedFile(file)
      setErrorMsg("")
      setState("selected")
    },
    [validateFile]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleUpload = async () => {
    if (!selectedFile || !customer) return

    setState("uploading")
    setErrorMsg("")

    try {
      // In a production setup, we would:
      // 1. Request a presigned S3 URL from the backend
      // 2. Upload the file directly to S3
      // 3. Call POST /store/prescriptions with the file_key
      //
      // For the prototype, we simulate success after a delay
      // since S3 presigned URL endpoint isn't wired yet.
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setState("success")
    } catch {
      setErrorMsg("Upload failed. Please try again.")
      setState("error")
    }
  }

  const handleReset = () => {
    setState("idle")
    setSelectedFile(null)
    setErrorMsg("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div style={{ background: "#F8F6F2", minHeight: "70vh" }}>
      <div className="content-container py-10 max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "#0E7C86" }}
          >
            Prescription Upload
          </p>
          <h1
            className="text-2xl lg:text-3xl font-semibold mb-3"
            style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}
          >
            Upload your prescription
          </h1>
          <p className="text-sm" style={{ color: "#666" }}>
            A registered pharmacist will review your prescription within 4 hours.
            You'll receive an SMS/email once approved.
          </p>
        </div>

        {/* Auth gate */}
        {!customer ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: "#fff", border: "1px solid #EDE9E1" }}
          >
            <p className="text-sm font-medium mb-2" style={{ color: "#0D1B2A" }}>
              Please sign in to upload a prescription
            </p>
            <p className="text-xs mb-6" style={{ color: "#666" }}>
              Your prescription is linked to your account for traceability and reordering.
            </p>
            <Link
              to="/$countryCode/account/login"
              params={{ countryCode }}
              search={{ redirectTo: `/${countryCode}/upload-rx` }}
              className="inline-flex px-6 py-2.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#0E7C86", color: "#fff" }}
            >
              Sign in to continue
            </Link>
          </div>
        ) : state === "success" ? (
          /* Success state */
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: "#fff", border: "1px solid #EDE9E1" }}
          >
            <div className="flex justify-center mb-4">
              <CheckCircleIcon />
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "#0D1B2A" }}>
              Prescription uploaded
            </h2>
            <p className="text-sm mb-6" style={{ color: "#666" }}>
              Our pharmacist will review your prescription and get back to you within 4 hours.
              You'll receive an SMS and email notification once it's approved.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleReset}
                className="px-5 py-2.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: "#0E7C86", color: "#fff" }}
              >
                Upload another
              </button>
              <Link
                to="/$countryCode/store"
                params={{ countryCode }}
                className="px-5 py-2.5 rounded text-sm font-medium transition-all"
                style={{ color: "#0D1B2A", border: "1px solid #EDE9E1", background: "#fff" }}
              >
                Browse medicines
              </Link>
            </div>
          </div>
        ) : (
          /* Upload form */
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "#fff", border: "1px solid #EDE9E1" }}
          >
            {/* Drop zone */}
            <div
              className="p-8 text-center cursor-pointer transition-colors"
              style={{
                background: dragOver ? "rgba(14,124,134,0.05)" : "transparent",
                borderBottom: selectedFile ? "1px solid #EDE9E1" : "none",
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                onChange={handleInputChange}
                className="hidden"
              />
              <div className="flex justify-center mb-4" style={{ color: "#0E7C86" }}>
                <UploadIcon />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: "#0D1B2A" }}>
                {selectedFile ? "Click or drag to replace" : "Drag & drop your prescription here"}
              </p>
              <p className="text-xs" style={{ color: "#999" }}>
                JPG, PNG, WebP, or PDF — max 10 MB
              </p>
            </div>

            {/* Selected file info */}
            {selectedFile && (
              <div className="px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div style={{ color: "#0E7C86" }}>
                    <FileIcon />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#0D1B2A" }}>
                      {selectedFile.name}
                    </p>
                    <p className="text-xs" style={{ color: "#999" }}>
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs font-medium underline flex-shrink-0"
                  style={{ color: "#C0392B" }}
                >
                  Remove
                </button>
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <div className="px-8 py-3" style={{ background: "rgba(192,57,43,0.06)" }}>
                <p className="text-xs font-medium" style={{ color: "#C0392B" }}>
                  {errorMsg}
                </p>
              </div>
            )}

            {/* Submit */}
            {selectedFile && state !== "error" && (
              <div className="px-8 py-5" style={{ borderTop: "1px solid #EDE9E1" }}>
                <button
                  onClick={handleUpload}
                  disabled={state === "uploading"}
                  className="w-full py-3 rounded text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: "#0E7C86", color: "#fff" }}
                >
                  {state === "uploading" ? (
                    <span className="flex items-center justify-center gap-2">
                      <span
                        className="w-4 h-4 border-2 rounded-full animate-spin"
                        style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                      />
                      Uploading...
                    </span>
                  ) : (
                    "Submit Prescription"
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Info section */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              title: "What we accept",
              body: "Clear photo or scan of your doctor's prescription. Must show doctor name, registration number, date, and drug names with dosage.",
            },
            {
              title: "Review timeline",
              body: "Our registered pharmacist reviews every prescription within 4 hours (9 AM–9 PM). You'll receive SMS + email confirmation.",
            },
            {
              title: "Privacy & retention",
              body: "Prescriptions are stored securely per DPDP Act 2023 and retained for 5 years as required by D&C Rules 1945.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="p-4 rounded-lg"
              style={{ background: "#fff", border: "1px solid #EDE9E1" }}
            >
              <h3 className="text-xs font-semibold mb-1.5" style={{ color: "#0D1B2A" }}>
                {item.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "#666" }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default UploadRx
