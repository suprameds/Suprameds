import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge, Button, Container, Heading, Select,
  Table, Text, toast, Drawer, Input, Label,
} from "@medusajs/ui"
import { BuildingStorefront, ArrowPath, PlusMini } from "@medusajs/icons"
import { useCallback, useEffect, useState } from "react"
import { sdk } from "../../../lib/client"

/* ================================================================
   TYPES
   ================================================================ */

type WarehouseZone = {
  id: string
  warehouse_id: string
  zone_code: string
  zone_type: string
  access_level?: string
  description?: string
  created_at: string
}

type WarehouseBin = {
  id: string
  zone_id: string
  bin_code: string
  bin_barcode?: string
  capacity_units: number
  current_units: number
  is_active: boolean
  last_audit_at?: string | null
  created_at: string
}

/* ================================================================
   HELPERS
   ================================================================ */

const cap = (s: string) =>
  s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

const zoneTypeColor = (t: string): "green" | "blue" | "orange" | "red" | "grey" | "purple" => {
  const map: Record<string, "green" | "blue" | "orange" | "red" | "grey" | "purple"> = {
    picking: "blue",
    receiving: "orange",
    staging: "grey",
    dispatch: "green",
    cold_chain: "purple",
    quarantine: "red",
    returns: "orange",
  }
  return map[t] || "grey"
}

const occupancyColor = (current: number, capacity: number): "green" | "orange" | "red" | "grey" => {
  if (capacity === 0) return "grey"
  const pct = current / capacity
  if (pct >= 0.9) return "red"
  if (pct >= 0.6) return "orange"
  return "green"
}

/* ================================================================
   ZONE TYPE OPTIONS
   ================================================================ */

const ZONE_TYPE_OPTIONS = [
  { value: "picking", label: "Picking" },
  { value: "receiving", label: "Receiving" },
  { value: "staging", label: "Staging" },
  { value: "dispatch", label: "Dispatch" },
  { value: "cold_chain", label: "Cold Chain" },
  { value: "quarantine", label: "Quarantine" },
  { value: "returns", label: "Returns" },
]

/* ================================================================
   CREATE ZONE DRAWER
   ================================================================ */

const CreateZoneDrawer = ({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) => {
  const [form, setForm] = useState({
    name: "",
    zone_code: "",
    zone_type: "picking",
    warehouse_id: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const reset = () => setForm({ name: "", zone_code: "", zone_type: "picking", warehouse_id: "" })

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    if (!form.zone_code.trim()) {
      toast.error("Zone Code is required")
      return
    }
    if (!form.warehouse_id.trim()) {
      toast.error("Warehouse ID is required")
      return
    }

    setSubmitting(true)
    try {
      await sdk.client.fetch<{ zone: WarehouseZone }>("/admin/warehouse/zones", {
        method: "POST",
        body: {
          warehouse_id: form.warehouse_id.trim(),
          zone_code: form.zone_code.trim().toUpperCase(),
          zone_type: form.zone_type,
          description: form.name.trim() || undefined,
        },
      })
      toast.success(`Zone "${form.zone_code.toUpperCase()}" created`)
      reset()
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error("Failed to create zone", { description: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Create Zone</Drawer.Title>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="zone-name" className="text-xs text-ui-fg-subtle">
              Name (optional)
            </Label>
            <Input
              id="zone-name"
              placeholder="e.g. Main Picking Area"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="zone-code" className="text-xs text-ui-fg-subtle">
              Zone Code <span className="text-ui-fg-error">*</span>
            </Label>
            <Input
              id="zone-code"
              placeholder="e.g. ZONE-A1"
              value={form.zone_code}
              onChange={(e) => setForm((p) => ({ ...p, zone_code: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-ui-fg-subtle">
              Zone Type
            </Label>
            <Select
              value={form.zone_type}
              onValueChange={(v) => setForm((p) => ({ ...p, zone_type: v }))}
            >
              <Select.Trigger><Select.Value placeholder="Select type" /></Select.Trigger>
              <Select.Content>
                {ZONE_TYPE_OPTIONS.map((o) => (
                  <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="warehouse-id" className="text-xs text-ui-fg-subtle">
              Warehouse ID <span className="text-ui-fg-error">*</span>
            </Label>
            <Input
              id="warehouse-id"
              placeholder="e.g. wh_01..."
              value={form.warehouse_id}
              onChange={(e) => setForm((p) => ({ ...p, warehouse_id: e.target.value }))}
            />
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            <PlusMini />
            {submitting ? "Creating..." : "Create Zone"}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/* ================================================================
   CREATE BIN DRAWER
   ================================================================ */

const CreateBinDrawer = ({
  open,
  zone,
  onClose,
  onSuccess,
}: {
  open: boolean
  zone: WarehouseZone | null
  onClose: () => void
  onSuccess: () => void
}) => {
  const [form, setForm] = useState({
    bin_code: "",
    bin_barcode: "",
    capacity_units: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const reset = () => setForm({ bin_code: "", bin_barcode: "", capacity_units: "" })

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    if (!zone) return
    if (!form.bin_code.trim()) {
      toast.error("Bin Code is required")
      return
    }
    if (!form.bin_barcode.trim()) {
      toast.error("Bin Barcode is required")
      return
    }

    setSubmitting(true)
    try {
      await sdk.client.fetch<{ bin: WarehouseBin }>("/admin/warehouse/bins", {
        method: "POST",
        body: {
          zone_id: zone.id,
          bin_code: form.bin_code.trim().toUpperCase(),
          bin_barcode: form.bin_barcode.trim(),
          capacity_units: form.capacity_units ? Number(form.capacity_units) : 0,
        },
      })
      toast.success(`Bin "${form.bin_code.toUpperCase()}" created in zone ${zone.zone_code}`)
      reset()
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error("Failed to create bin", { description: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Add Bin</Drawer.Title>
          {zone && (
            <Text className="text-sm text-ui-fg-subtle">
              Zone: <span className="font-medium">{zone.zone_code}</span>
              {" · "}{cap(zone.zone_type)}
            </Text>
          )}
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="bin-code" className="text-xs text-ui-fg-subtle">
              Bin Code <span className="text-ui-fg-error">*</span>
            </Label>
            <Input
              id="bin-code"
              placeholder="e.g. BIN-001"
              value={form.bin_code}
              onChange={(e) => setForm((p) => ({ ...p, bin_code: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="bin-barcode" className="text-xs text-ui-fg-subtle">
              Bin Barcode <span className="text-ui-fg-error">*</span>
            </Label>
            <Input
              id="bin-barcode"
              placeholder="Scan or enter barcode"
              value={form.bin_barcode}
              onChange={(e) => setForm((p) => ({ ...p, bin_barcode: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="capacity" className="text-xs text-ui-fg-subtle">
              Capacity (units)
            </Label>
            <Input
              id="capacity"
              type="number"
              placeholder="0"
              min="0"
              value={form.capacity_units}
              onChange={(e) => setForm((p) => ({ ...p, capacity_units: e.target.value }))}
            />
          </div>

          <div className="p-3 rounded-lg bg-ui-bg-subtle border border-ui-border-base">
            <Text className="text-xs text-ui-fg-subtle">Zone</Text>
            <Text className="text-sm font-medium">{zone?.zone_code || "—"}</Text>
            <Text className="text-xs text-ui-fg-muted">{zone ? cap(zone.zone_type) : ""}</Text>
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            <PlusMini />
            {submitting ? "Creating..." : "Create Bin"}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

const ZonesBinsPage = () => {
  const [zones, setZones] = useState<WarehouseZone[]>([])
  const [bins, setBins] = useState<WarehouseBin[]>([])
  const [selectedZone, setSelectedZone] = useState<WarehouseZone | null>(null)
  const [loadingZones, setLoadingZones] = useState(true)
  const [loadingBins, setLoadingBins] = useState(false)
  const [createZoneOpen, setCreateZoneOpen] = useState(false)
  const [createBinOpen, setCreateBinOpen] = useState(false)
  const [binZone, setBinZone] = useState<WarehouseZone | null>(null)

  // Bin counts per zone (fetched together with zones via bins endpoint not used here — we show bin count from local state)
  const [binCountByZone, setBinCountByZone] = useState<Record<string, number>>({})

  const fetchZones = useCallback(async () => {
    setLoadingZones(true)
    try {
      const json = await sdk.client.fetch<{ data?: WarehouseZone[] }>("/admin/warehouse/zones")
      const list = json.data ?? []
      setZones(list)

      // Fetch bin counts for all zones in parallel
      const counts: Record<string, number> = {}
      await Promise.allSettled(
        list.map(async (z) => {
          try {
            const bRes = await sdk.client.fetch<{ count?: number; data?: any[] }>(
              "/admin/warehouse/bins",
              { query: { zone_id: z.id, limit: "1" } }
            )
            counts[z.id] = bRes.count ?? bRes.data?.length ?? 0
          } catch {
            counts[z.id] = 0
          }
        })
      )
      setBinCountByZone(counts)
    } catch (err: any) {
      console.error("[warehouse-zones]", err)
      toast.error("Failed to load zones", { description: err.message })
      setZones([])
    } finally {
      setLoadingZones(false)
    }
  }, [])

  const fetchBins = useCallback(async (zone: WarehouseZone) => {
    setLoadingBins(true)
    try {
      const json = await sdk.client.fetch<{ data?: WarehouseBin[] }>(
        "/admin/warehouse/bins",
        { query: { zone_id: zone.id } }
      )
      setBins(json.data ?? [])
    } catch (err: any) {
      console.error("[warehouse-bins]", err)
      toast.error("Failed to load bins", { description: err.message })
      setBins([])
    } finally {
      setLoadingBins(false)
    }
  }, [])

  useEffect(() => { fetchZones() }, [fetchZones])

  const handleSelectZone = (zone: WarehouseZone) => {
    setSelectedZone(zone)
    fetchBins(zone)
  }

  const handleAddBin = (zone: WarehouseZone) => {
    setBinZone(zone)
    setCreateBinOpen(true)
  }

  const handleBinCreated = () => {
    if (selectedZone) fetchBins(selectedZone)
    fetchZones()
  }

  return (
    <div className="flex flex-col gap-4">
      <Container className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h1" className="mb-2">Zones &amp; Bins</Heading>
            <Text className="text-ui-fg-subtle">
              Manage warehouse zones and storage bin locations. Select a zone to view its bins.
            </Text>
          </div>
          <Button variant="primary" size="small" onClick={() => setCreateZoneOpen(true)}>
            <PlusMini /> Add Zone
          </Button>
        </div>
      </Container>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-0">
        {/* Zone List Panel */}
        <Container className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Heading level="h2">Zones</Heading>
            <Button variant="secondary" size="small" onClick={fetchZones}>
              <ArrowPath /> Refresh
            </Button>
          </div>

          {loadingZones ? (
            <Text className="text-ui-fg-subtle p-4">Loading zones...</Text>
          ) : zones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Text className="text-ui-fg-subtle mb-1">No zones configured.</Text>
              <Text className="text-xs text-ui-fg-muted">Click &quot;Add Zone&quot; to create your first warehouse zone.</Text>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedZone?.id === zone.id
                      ? "border-ui-border-interactive bg-ui-bg-highlight"
                      : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-base-hover"
                  }`}
                  onClick={() => handleSelectZone(zone)}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Text className="text-sm font-medium font-mono">{zone.zone_code}</Text>
                      <Badge color={zoneTypeColor(zone.zone_type)} size="xsmall">
                        {cap(zone.zone_type)}
                      </Badge>
                    </div>
                    {zone.description && (
                      <Text className="text-xs text-ui-fg-subtle">{zone.description}</Text>
                    )}
                    <Text className="text-xs text-ui-fg-muted">
                      Access: {cap(zone.access_level || "open")}
                    </Text>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge color="grey">{binCountByZone[zone.id] ?? 0} bins</Badge>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddBin(zone)
                      }}
                    >
                      <PlusMini /> Add Bin
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Container>

        {/* Bins Panel */}
        <Container className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Heading level="h2">Bins</Heading>
              {selectedZone && (
                <Text className="text-sm text-ui-fg-subtle">
                  Zone: <span className="font-medium font-mono">{selectedZone.zone_code}</span>
                  {" · "}{cap(selectedZone.zone_type)}
                </Text>
              )}
            </div>
            {selectedZone && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => fetchBins(selectedZone)}
              >
                <ArrowPath /> Refresh
              </Button>
            )}
          </div>

          {!selectedZone ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Text className="text-ui-fg-subtle mb-1">Select a zone to view its bins.</Text>
            </div>
          ) : loadingBins ? (
            <Text className="text-ui-fg-subtle p-4">Loading bins...</Text>
          ) : bins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Text className="text-ui-fg-subtle mb-1">No bins in this zone.</Text>
              <Text className="text-xs text-ui-fg-muted">
                Click &quot;Add Bin&quot; on the zone to create a storage bin.
              </Text>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Bin Code</Table.HeaderCell>
                  <Table.HeaderCell>Barcode</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Capacity</Table.HeaderCell>
                  <Table.HeaderCell>Occupancy</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {bins.map((bin) => {
                  const pct = bin.capacity_units > 0
                    ? Math.round((bin.current_units / bin.capacity_units) * 100)
                    : 0
                  return (
                    <Table.Row key={bin.id}>
                      <Table.Cell>
                        <Text className="text-sm font-mono font-medium">{bin.bin_code}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text className="text-xs font-mono text-ui-fg-subtle">{bin.bin_barcode || "—"}</Text>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Text className="text-sm">{bin.capacity_units || "—"}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        {bin.capacity_units > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-ui-bg-component overflow-hidden min-w-[60px]">
                                <div
                                  className={`h-full rounded-full ${
                                    pct >= 90 ? "bg-ui-fg-error" :
                                    pct >= 60 ? "bg-ui-fg-warning" :
                                    "bg-ui-fg-positive"
                                  }`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <Badge color={occupancyColor(bin.current_units, bin.capacity_units)} size="xsmall">
                                {pct}%
                              </Badge>
                            </div>
                            <Text className="text-xs text-ui-fg-muted">
                              {bin.current_units}/{bin.capacity_units}
                            </Text>
                          </div>
                        ) : (
                          <Text className="text-xs text-ui-fg-muted">—</Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={bin.is_active ? "green" : "grey"}>
                          {bin.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table>
          )}
        </Container>
      </div>

      <CreateZoneDrawer
        open={createZoneOpen}
        onClose={() => setCreateZoneOpen(false)}
        onSuccess={fetchZones}
      />

      <CreateBinDrawer
        open={createBinOpen}
        zone={binZone}
        onClose={() => { setCreateBinOpen(false); setBinZone(null) }}
        onSuccess={handleBinCreated}
      />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Zones & Bins",
  icon: BuildingStorefront,
})

export default ZonesBinsPage
