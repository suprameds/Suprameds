import { Button } from "@/components/ui/button"
import { useCustomer } from "@/lib/hooks/use-customer"
import {
  useCustomerPrescriptions,
  useCartRxStatus,
  useAttachPrescription,
  useUploadPrescription,
  type PrescriptionSummary,
} from "@/lib/hooks/use-prescriptions"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { HttpTypes } from "@medusajs/types"
import { Link, useLocation } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"

// ── Icons ──────────────────────────────────────────────────────────

const RxIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h6a3 3 0 0 1 0 6H6V3z" />
    <line x1="6" y1="3" x2="6" y2="21" />
    <line x1="12" y1="9" x2="18" y2="21" />
    <line x1="18" y1="9" x2="12" y2="21" />
  </svg>
)

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const FileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

// ── Status badge ───────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  pending_review: { label: "Pending review", color: "#92400E", bg: "#FEF3C7" },
  approved: { label: "Approved", color: "#065F46", bg: "#ECFDF5" },
  rejected: { label: "Rejected", color: "#991B1B", bg: "#FEF2F2" },
  expired: { label: "Expired", color: "#6B7280", bg: "#F3F4F6" },
  used: { label: "Used", color: "#1E40AF", bg: "#DBEAFE" },
}

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_STYLES[status] ?? { label: status, color: "#374151", bg: "#F3F4F6" }
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={{ color: s.color, background: s.bg }}
    >
      {s.label}
    </span>
  )
}

// ── File upload constants ──────────────────────────────────────────

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
const MAX_FILE_SIZE = 10 * 1024 * 1024

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// ── Main component ─────────────────────────────────────────────────

interface PrescriptionStepProps {
  cart: HttpTypes.StoreCart
  onNext: () => void
  onBack: () => void
}

const PrescriptionStep = ({ cart, onNext, onBack }: PrescriptionStepProps) => {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const { data: customer } = useCustomer()
  const isAuthenticated = !!customer

  const {
    data: rxStatus,
    isLoading: rxLoading,
  } = useCartRxStatus(cart.id)

  const {
    data: prescriptions = [],
    isLoading: prescriptionsLoading,
  } = useCustomerPrescriptions({ enabled: isAuthenticated })

  const attachMutation = useAttachPrescription()
  const uploadMutation = useUploadPrescription()

  const [selectedId, setSelectedId] = useState<string | null>(
    rxStatus?.prescription_id ?? null
  )
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync selectedId when rxStatus loads (must be in useEffect, not during render)
  useEffect(() => {
    if (rxStatus?.prescription_id && selectedId === null) {
      setSelectedId(rxStatus.prescription_id)
    }
  }, [rxStatus?.prescription_id, selectedId])

  // ── Attach handler ──────────────────────────────────────────────

  const handleAttach = useCallback(
    async (prescriptionId: string) => {
      setSelectedId(prescriptionId)
      await attachMutation.mutateAsync({
        cartId: cart.id,
        prescriptionId,
      })
    },
    [cart.id, attachMutation]
  )

  // ── Upload handlers ─────────────────────────────────────────────

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
        setUploadError(error)
        return
      }
      setUploadFile(file)
      setUploadError("")
    },
    [validateFile]
  )

  const handleUploadSubmit = useCallback(async () => {
    if (!uploadFile) return

    setUploadError("")

    try {
      const fileKey = `rx/${Date.now()}-${uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

      // Convert file to base64 data URL so the admin can preview it.
      // In production, replace with presigned S3 upload.
      const fileUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsDataURL(uploadFile)
      })

      const { prescription } = await uploadMutation.mutateAsync({
        file_key: fileKey,
        file_url: fileUrl,
        original_filename: uploadFile.name,
        mime_type: uploadFile.type,
        file_size_bytes: uploadFile.size,
      })

      await handleAttach(prescription.id)
      setShowUpload(false)
      setUploadFile(null)
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      )
    }
  }, [uploadFile, uploadMutation, handleAttach])

  // ── Proceed ─────────────────────────────────────────────────────

  const handleNext = useCallback(async () => {
    if (!selectedId) return

    // Make sure it's attached (it should be, but double-check)
    if (rxStatus?.prescription_id !== selectedId) {
      await attachMutation.mutateAsync({
        cartId: cart.id,
        prescriptionId: selectedId,
      })
    }

    onNext()
  }, [selectedId, rxStatus, attachMutation, cart.id, onNext])

  // ── Filter prescriptions: approved and pending_review ───────────

  const selectablePrescriptions = prescriptions.filter(
    (rx) => rx.status === "approved" || rx.status === "pending_review"
  )

  const isLoading = rxLoading || prescriptionsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: "#EDE9E1", borderTopColor: "#0E7C86" }}
        />
      </div>
    )
  }

  // Guest checkout — prescription requires an account for traceability
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col gap-6">
        <div
          className="rounded-lg border p-4 flex items-start gap-3"
          style={{ borderColor: "#F39C12", background: "rgba(243,156,18,0.06)" }}
        >
          <div className="mt-0.5" style={{ color: "#92400E" }}>
            <RxIcon />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "#92400E" }}>
              Your cart contains prescription medicines
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
              A valid prescription is required to purchase Rx medicines.
            </p>
          </div>
        </div>

        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "#fff", border: "1px solid #EDE9E1" }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: "#0D1B2A" }}>
            Please sign in to attach a prescription
          </p>
          <p className="text-xs mb-5" style={{ color: "#6B7280" }}>
            Prescriptions are linked to your account for traceability, pharmacist review, and reordering.
          </p>
          <Link
            to="/$countryCode/account/login"
            params={{ countryCode }}
            search={{ redirectTo: location.href }}
            className="inline-flex px-5 py-2.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "#0E7C86", color: "#fff" }}
          >
            Sign in to continue
          </Link>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header info */}
      <div
        className="rounded-lg border p-4 flex items-start gap-3"
        style={{ borderColor: "#F39C12", background: "rgba(243,156,18,0.06)" }}
      >
        <div className="mt-0.5" style={{ color: "#92400E" }}>
          <RxIcon />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: "#92400E" }}>
            Your cart contains prescription medicines
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
            Attach one prescription to cover all Rx items. A pharmacist will verify it before dispatch.
            You can add any number of medicines under a single prescription.
          </p>
        </div>
      </div>

      {/* Saved prescriptions list */}
      {selectablePrescriptions.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold" style={{ color: "#0D1B2A" }}>
            Your saved prescriptions
          </h3>

          {selectablePrescriptions.map((rx) => (
            <PrescriptionCard
              key={rx.id}
              prescription={rx}
              isSelected={selectedId === rx.id}
              isAttaching={attachMutation.isPending}
              onSelect={() => handleAttach(rx.id)}
            />
          ))}
        </div>
      )}

      {/* No prescriptions message */}
      {selectablePrescriptions.length === 0 && !showUpload && (
        <div className="text-center py-6">
          <p className="text-sm" style={{ color: "#6B7280" }}>
            You don't have any saved prescriptions yet.
          </p>
          <p className="text-xs mt-1" style={{ color: "#999" }}>
            Upload a new prescription below to continue.
          </p>
        </div>
      )}

      {/* Upload toggle / form */}
      {!showUpload ? (
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors"
          style={{
            border: "1px dashed #D1D5DB",
            color: "#0E7C86",
            background: "transparent",
          }}
        >
          <UploadIcon />
          Upload a new prescription
        </button>
      ) : (
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: "1px solid #EDE9E1", background: "#fff" }}
        >
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #EDE9E1" }}>
            <h4 className="text-sm font-semibold" style={{ color: "#0D1B2A" }}>
              Upload new prescription
            </h4>
            <button
              onClick={() => {
                setShowUpload(false)
                setUploadFile(null)
                setUploadError("")
              }}
              className="text-xs underline"
              style={{ color: "#6B7280" }}
            >
              Cancel
            </button>
          </div>

          {/* Drop zone */}
          <div
            className="px-6 py-6 text-center cursor-pointer transition-colors"
            style={{ background: dragOver ? "rgba(14,124,134,0.04)" : "transparent" }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const file = e.dataTransfer.files?.[0]
              if (file) handleFileSelect(file)
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
              className="hidden"
            />
            <div className="flex justify-center mb-2" style={{ color: "#0E7C86" }}>
              <UploadIcon />
            </div>
            <p className="text-sm" style={{ color: "#0D1B2A" }}>
              {uploadFile ? uploadFile.name : "Click or drag to select file"}
            </p>
            <p className="text-xs mt-1" style={{ color: "#999" }}>
              JPG, PNG, WebP, or PDF — max 10 MB
            </p>
          </div>

          {/* File preview */}
          {uploadFile && (
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderTop: "1px solid #EDE9E1" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "#0D1B2A" }}>
                    {uploadFile.name}
                  </p>
                  <p className="text-[10px]" style={{ color: "#999" }}>
                    {formatFileSize(uploadFile.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setUploadFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
                className="text-[10px] underline flex-shrink-0"
                style={{ color: "#C0392B" }}
              >
                Remove
              </button>
            </div>
          )}

          {uploadError && (
            <div className="px-4 py-2" style={{ background: "rgba(192,57,43,0.06)" }}>
              <p className="text-xs" style={{ color: "#C0392B" }}>{uploadError}</p>
            </div>
          )}

          {uploadFile && (
            <div className="px-4 py-3" style={{ borderTop: "1px solid #EDE9E1" }}>
              <button
                onClick={handleUploadSubmit}
                disabled={uploadMutation.isPending}
                className="w-full py-2.5 rounded text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "#0E7C86", color: "#fff" }}
              >
                {uploadMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span
                      className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                      style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                    />
                    Uploading...
                  </span>
                ) : (
                  "Upload & attach to this order"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Attached prescription summary */}
      {selectedId && (
        <div
          className="rounded-lg border p-3 flex items-center gap-2"
          style={{ borderColor: "#27AE60", background: "rgba(39,174,96,0.06)" }}
        >
          <div style={{ color: "#065F46" }}>
            <CheckIcon />
          </div>
          <p className="text-xs font-medium" style={{ color: "#065F46" }}>
            Prescription attached to this order
          </p>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center gap-4 pt-2">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!selectedId || attachMutation.isPending}
          data-testid="prescription-next-button"
        >
          {attachMutation.isPending ? "Saving..." : "Continue to Payment"}
        </Button>
      </div>
    </div>
  )
}

// ── Prescription card (for selecting a saved prescription) ─────────

interface PrescriptionCardProps {
  prescription: PrescriptionSummary
  isSelected: boolean
  isAttaching: boolean
  onSelect: () => void
}

const PrescriptionCard = ({
  prescription,
  isSelected,
  isAttaching,
  onSelect,
}: PrescriptionCardProps) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isAttaching}
      className="w-full text-left rounded-lg border p-4 transition-all disabled:opacity-60"
      style={{
        borderColor: isSelected ? "#27AE60" : "#E5E7EB",
        background: isSelected ? "rgba(39,174,96,0.04)" : "#fff",
        boxShadow: isSelected ? "0 0 0 1px #27AE60" : "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Radio-like indicator */}
          <div
            className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{
              borderColor: isSelected ? "#27AE60" : "#D1D5DB",
              background: isSelected ? "#27AE60" : "transparent",
            }}
          >
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium" style={{ color: "#0D1B2A" }}>
                {prescription.original_filename || "Prescription"}
              </p>
              <StatusBadge status={prescription.status} />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
              {prescription.doctor_name && (
                <p className="text-xs" style={{ color: "#6B7280" }}>
                  Dr. {prescription.doctor_name}
                </p>
              )}
              {prescription.patient_name && (
                <p className="text-xs" style={{ color: "#6B7280" }}>
                  Patient: {prescription.patient_name}
                </p>
              )}
              <p className="text-xs" style={{ color: "#999" }}>
                Uploaded {formatDate(prescription.created_at)}
              </p>
              {prescription.valid_until && (
                <p className="text-xs" style={{ color: "#999" }}>
                  Valid until {formatDate(prescription.valid_until)}
                </p>
              )}
            </div>

            {prescription.status === "pending_review" && (
              <p
                className="text-[10px] mt-1.5 px-2 py-0.5 rounded inline-block"
                style={{ background: "#FEF3C7", color: "#92400E" }}
              >
                Pharmacist review usually takes up to 4 hours
              </p>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

export default PrescriptionStep
