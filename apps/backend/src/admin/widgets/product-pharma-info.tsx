import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Badge, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { sdk } from "../lib/client"

type DrugProduct = {
  id: string
  schedule: string
  generic_name: string
  composition: string | null
  strength: string | null
  dosage_form: string
  pack_size: string | null
  unit_type: string
  therapeutic_class: string | null
  gst_rate: number
  hsn_code: string | null
  mrp_paise: number | null
  indications: string | null
  contraindications: string | null
  side_effects: string | null
  storage_instructions: string | null
  dosage_instructions: string | null
  is_chronic: boolean
  habit_forming: boolean
  requires_refrigeration: boolean
  is_narcotic: boolean
}

const scheduleBadge = (schedule: string) => {
  switch (schedule) {
    case "OTC":
      return <Badge color="green">OTC</Badge>
    case "H":
      return <Badge color="orange">Schedule H — Rx Required</Badge>
    case "H1":
      return <Badge color="red">Schedule H1 — Strict Rx</Badge>
    case "X":
      return <Badge color="red">Schedule X — PROHIBITED</Badge>
    default:
      return <Badge color="grey">{schedule}</Badge>
  }
}

const Row = ({ label, value }: { label: string; value: string | number | null | undefined }) => {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between py-1.5 border-b border-ui-border-base last:border-0">
      <Text className="text-ui-fg-subtle text-sm">{label}</Text>
      <Text className="text-sm font-medium text-right max-w-[60%]">{String(value)}</Text>
    </div>
  )
}

const ProductPharmaWidget = ({ data: product }: { data: { id: string } }) => {
  const [drug, setDrug] = useState<DrugProduct | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!product?.id) return
    sdk.client
      .fetch<{ drug_product: DrugProduct | null }>(
        `/admin/pharma/drug-products?product_id=${product.id}`,
        { method: "GET" }
      )
      .then((res) => setDrug(res.drug_product))
      .catch(() => setDrug(null))
      .finally(() => setLoading(false))
  }, [product?.id])

  if (loading) {
    return (
      <Container>
        <Heading level="h2">Pharma Metadata</Heading>
        <Text className="text-ui-fg-subtle mt-2">Loading...</Text>
      </Container>
    )
  }

  if (!drug) {
    return (
      <Container>
        <Heading level="h2">Pharma Metadata</Heading>
        <Text className="text-ui-fg-subtle mt-2">
          No drug metadata found for this product. If this is a medicine,
          use <strong>Create Medicine</strong> to add it with pharma details.
        </Text>
      </Container>
    )
  }

  return (
    <Container>
      <div className="flex items-center justify-between mb-4">
        <Heading level="h2">Pharma Metadata</Heading>
        {scheduleBadge(drug.schedule)}
      </div>

      <div className="flex flex-col">
        <Row label="Generic Name" value={drug.generic_name} />
        <Row label="Composition" value={drug.composition} />
        <Row label="Strength" value={drug.strength} />
        <Row label="Dosage Form" value={drug.dosage_form} />
        <Row label="Pack Size" value={drug.pack_size} />
        <Row label="Unit Type" value={drug.unit_type} />
        <Row label="Therapeutic Class" value={drug.therapeutic_class} />
        <Row label="GST Rate" value={drug.gst_rate ? `${drug.gst_rate}%` : null} />
        <Row label="HSN Code" value={drug.hsn_code} />
        <Row label="MRP" value={drug.mrp_paise ? `₹${(drug.mrp_paise / 100).toFixed(2)}` : null} />
      </div>

      {(drug.indications || drug.contraindications || drug.side_effects) && (
        <div className="mt-4 pt-4 border-t border-ui-border-base">
          <Text className="text-sm font-semibold mb-2">Clinical Info</Text>
          <Row label="Indications" value={drug.indications} />
          <Row label="Contraindications" value={drug.contraindications} />
          <Row label="Side Effects" value={drug.side_effects} />
          <Row label="Dosage" value={drug.dosage_instructions} />
          <Row label="Storage" value={drug.storage_instructions} />
        </div>
      )}

      {(drug.is_chronic || drug.habit_forming || drug.requires_refrigeration || drug.is_narcotic) && (
        <div className="mt-4 pt-4 border-t border-ui-border-base flex flex-wrap gap-2">
          {drug.is_chronic && <Badge color="blue">Chronic</Badge>}
          {drug.habit_forming && <Badge color="orange">Habit-forming</Badge>}
          {drug.requires_refrigeration && <Badge color="purple">Cold Chain</Badge>}
          {drug.is_narcotic && <Badge color="red">Narcotic</Badge>}
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductPharmaWidget
