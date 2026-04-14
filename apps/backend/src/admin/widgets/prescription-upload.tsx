import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Badge,
  Button,
  toast,
} from "@medusajs/ui"
import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "react-router-dom"
import { sdk } from "../lib/client"

type Prescription = {
  id: string
  status: "pending_review" | "approved" | "rejected" | "expired" | "used"
  file_url: string | null
  original_filename: string | null
  patient_name: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, "green" | "orange" | "red" | "grey" | "blue"> = {
  pending_review: "orange",
  approved: "green",
  rejected: "red",
  expired: "grey",
  used: "blue",
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const formatDate = (d?: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Converts a File to a base64 data URI string.
 */
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const PrescriptionUploadWidget = () => {
  const { id: orderId } = useParams<{ id: string }>()

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRxOrder, setIsRxOrder] = useState<boolean | null>(null)
  const [uploading, setUploading] = useState(false)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    try {
      const [orderJson, rxJson] = await Promise.all([
        sdk.client.fetch<{ order: any }>(
          `/admin/orders/${orderId}`,
          { query: { fields: "+customer_id,+email,items.*" } }
        ),
        sdk.client.fetch<{ prescriptions: Prescription[] }>(
          `/admin/prescriptions`,
          { query: { order_id: orderId } }
        ),
      ])

      setCustomerId(orderJson.order?.customer_id ?? null)

      // Check if any item is Schedule H/H1 (Rx)
      const orderItems = orderJson.order?.items ?? []
      const productIds = orderItems.map((i: any) => i.product_id).filter(Boolean)
      let hasRx = false
      if (productIds.length > 0) {
        try {
          const drugJson = await sdk.client.fetch<{ drug_products: any[] }>(
            `/admin/pharma/drug-products`,
            { query: { product_id: productIds.join(",") } }
          )
          const drugs = drugJson.drug_products ?? []
          hasRx = drugs.some((d: any) => d.schedule === "H" || d.schedule === "H1")
        } catch { hasRx = true }
      }
      setIsRxOrder(hasRx)

      setPrescriptions(rxJson.prescriptions ?? [])
    } catch {
      toast.error("Failed to load order data")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Clean up object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Invalid file type. Accepted: JPG, PNG, WebP, PDF")
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 10 MB.")
      return
    }

    // Revoke previous preview URL
    if (previewUrl) URL.revokeObjectURL(previewUrl)

    setSelectedFile(file)
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file))
    } else {
      setPreviewUrl(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first")
      return
    }
    if (!orderId) {
      toast.error("Order ID not available")
      return
    }

    setUploading(true)
    try {
      const base64 = await fileToBase64(selectedFile)

      await sdk.client.fetch("/admin/prescriptions", {
        method: "POST",
        body: {
          order_id: orderId,
          customer_id: customerId,
          file: base64,
          original_filename: selectedFile.name,
          mime_type: selectedFile.type,
          file_size_bytes: selectedFile.size,
        },
      })

      toast.success("Prescription uploaded successfully")
      clearSelection()
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload prescription")
    } finally {
      setUploading(false)
    }
  }

  const clearSelection = () => {
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Hide widget entirely for OTC-only orders
  if (isRxOrder === false) return null

  if (loading) {
    return (
      <Container>
        <Heading level="h2">Prescription Upload</Heading>
        <Text className="text-ui-fg-subtle mt-2">Loading…</Text>
      </Container>
    )
  }

  return (
    <Container>
      <Heading level="h2" className="mb-4">
        Prescription Upload
      </Heading>

      {/* Existing prescriptions */}
      {prescriptions.length > 0 && (
        <div className="mb-4">
          <Text className="text-sm font-medium mb-2">
            Linked Prescriptions ({prescriptions.length})
          </Text>
          <div className="flex flex-col gap-2">
            {prescriptions.map((rx) => (
              <div
                key={rx.id}
                className="flex items-center justify-between border border-ui-border-base rounded p-2"
              >
                <div className="flex items-center gap-2">
                  <Badge color={STATUS_COLORS[rx.status] || "grey"}>
                    {rx.status.replace("_", " ")}
                  </Badge>
                  <Text className="text-sm">
                    {rx.original_filename || rx.id}
                  </Text>
                  {rx.patient_name && (
                    <Text className="text-xs text-ui-fg-subtle">
                      — {rx.patient_name}
                    </Text>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Text className="text-xs text-ui-fg-subtle">
                    {formatDate(rx.created_at)}
                  </Text>
                  {rx.file_url && (
                    <a
                      href={rx.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload form */}
      <div className="border border-dashed border-ui-border-strong rounded-lg p-4">
        <Text className="text-sm font-medium mb-2">
          Upload New Prescription
        </Text>
        <Text className="text-xs text-ui-fg-subtle mb-3">
          Accepted: JPG, PNG, WebP, PDF — Max 10 MB
        </Text>

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          onChange={handleFileSelect}
          className="block w-full text-sm text-ui-fg-subtle
            file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0
            file:text-sm file:font-medium file:bg-ui-bg-subtle
            file:text-ui-fg-base hover:file:bg-ui-bg-subtle-hover
            cursor-pointer"
        />

        {/* Preview */}
        {selectedFile && (
          <div className="mt-3">
            {previewUrl && (
              <div className="mb-2">
                <img
                  src={previewUrl}
                  alt="Prescription preview"
                  className="max-h-48 rounded border border-ui-border-base object-contain"
                />
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <Text className="text-ui-fg-subtle">
                {selectedFile.name}
              </Text>
              <Text className="text-xs text-ui-fg-muted">
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </Text>
              {selectedFile.type === "application/pdf" && (
                <Badge color="grey">PDF</Badge>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              <Button
                variant="primary"
                size="small"
                isLoading={uploading}
                disabled={uploading}
                onClick={handleUpload}
              >
                Upload Prescription
              </Button>
              <Button
                variant="secondary"
                size="small"
                disabled={uploading}
                onClick={clearSelection}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {!selectedFile && (
          <div className="mt-3 text-center py-4">
            <Text className="text-ui-fg-muted text-sm">
              Select a prescription image or PDF to upload on behalf of the
              customer.
            </Text>
          </div>
        )}
      </div>

      {!customerId && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2">
          <Text className="text-amber-800 text-xs">
            No customer ID found on this order. The prescription will be
            uploaded without a customer link. This typically happens for guest
            orders.
          </Text>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default PrescriptionUploadWidget
