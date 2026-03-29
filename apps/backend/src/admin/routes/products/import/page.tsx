import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowUpTray } from "@medusajs/icons"
import { Container, Heading, Text, Button } from "@medusajs/ui"

const ProductImportOverride = () => {
  const backendUrl = (window as any).__BACKEND_URL__ ?? ""

  return (
    <Container className="flex flex-col items-center gap-y-4 py-16">
      <div className="flex size-14 items-center justify-center rounded-full border bg-ui-bg-subtle">
        <ArrowUpTray className="text-ui-fg-subtle" />
      </div>
      <div className="flex flex-col items-center gap-y-1">
        <Heading level="h2">Import Medicines via CSV</Heading>
        <Text size="small" className="text-ui-fg-subtle text-center max-w-md">
          The built-in Medusa import uses EUR/USD pricing and doesn't support
          pharma metadata (drug schedule, composition, batches). Use our pharma
          import instead — it handles INR pricing, drug metadata, inventory, and
          batch creation in one step.
        </Text>
      </div>

      <div className="flex flex-col gap-y-3 mt-4 w-full max-w-md">
        <div className="rounded-lg border p-4 bg-ui-bg-subtle">
          <Text size="small" weight="plus" className="mb-2">
            Option 1: Admin API
          </Text>
          <code className="text-xs text-ui-fg-muted block">
            POST {backendUrl}/admin/pharma/import
          </code>
          <Text size="xsmall" className="text-ui-fg-muted mt-1">
            Send CSV as {"{"}"csv": "..."{"}"}  or pre-parsed rows as {"{"}"rows": [...]{"}"}
          </Text>
        </div>

        <div className="rounded-lg border p-4 bg-ui-bg-subtle">
          <Text size="small" weight="plus" className="mb-2">
            Option 2: CLI Script
          </Text>
          <code className="text-xs text-ui-fg-muted block">
            npx medusa exec ./src/scripts/import-fresh-data.ts
          </code>
          <Text size="xsmall" className="text-ui-fg-muted mt-1">
            Imports products, inventory, customers, and pincodes from data/ CSVs
          </Text>
        </div>
      </div>

      <Button variant="secondary" className="mt-4" onClick={() => window.history.back()}>
        Go Back
      </Button>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Import Medicines",
  icon: ArrowUpTray,
})

export default ProductImportOverride
