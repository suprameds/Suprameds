import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge, Button, Container, Heading, Select,
  Table, Tabs, Text, toast,
} from "@medusajs/ui"
import { ArrowPath, CheckCircleSolid, CommandLineSolid, PlusMini } from "@medusajs/icons"
import { useCallback, useEffect, useState } from "react"
import { sdk } from "../../lib/client"

/* ================================================================
   TYPES
   ================================================================ */

type WarehouseTask = {
  id: string
  task_type: string
  reference_type: string
  reference_id: string
  assigned_to: string | null
  warehouse_id: string
  priority: "low" | "normal" | "high" | "urgent"
  status: "pending" | "assigned" | "in_progress" | "completed" | "exception"
  started_at: string | null
  completed_at: string | null
  exception_notes: string | null
  created_at: string
}

type PickListLine = {
  id: string
  task_id: string
  order_item_id: string
  allocation_id: string
  batch_id: string
  bin_id: string
  quantity_to_pick: number
  quantity_picked: number
  status: "pending" | "picked" | "short_pick" | "exception"
  picked_by: string | null
  picked_at: string | null
  exception_reason: string | null
  created_at?: string
}

type OverviewStats = {
  total_warehouses: number
  active_zones: number
  total_bins: number
  pending_tasks: number
  grn_pending_qc: number
  pick_lists_pending: number
  tasks_today: number
}

/* ================================================================
   HELPERS
   ================================================================ */

const fmtDateTime = (d?: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const cap = (s: string) =>
  s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

const taskTypeColor = (t: string): "green" | "blue" | "orange" | "red" | "grey" | "purple" => {
  const map: Record<string, "green" | "blue" | "orange" | "red" | "grey" | "purple"> = {
    pick: "blue", pack: "purple", dispatch: "green", receive: "orange",
    inspect: "orange", put_away: "grey", return_inspect: "red",
    cycle_count: "grey", pre_dispatch_check: "blue",
  }
  return map[t] || "grey"
}

const statusColor = (s: string): "green" | "blue" | "orange" | "red" | "grey" => {
  const map: Record<string, "green" | "blue" | "orange" | "red" | "grey"> = {
    pending: "orange", assigned: "blue", in_progress: "blue",
    completed: "green", exception: "red",
  }
  return map[s] || "grey"
}

const priorityColor = (p: string): "red" | "blue" | "grey" => {
  const map: Record<string, "red" | "blue" | "grey"> = {
    high: "red", urgent: "red", normal: "blue", low: "grey",
  }
  return map[p] || "grey"
}

const pickStatusColor = (s: string): "green" | "orange" | "red" | "grey" => {
  const map: Record<string, "green" | "orange" | "red" | "grey"> = {
    pending: "orange", picked: "green", short_pick: "red", exception: "red",
  }
  return map[s] || "grey"
}

/* ================================================================
   STAT CARD
   ================================================================ */

const StatCard = ({ label, value, sub }: {
  label: string; value: string | number; sub?: string
}) => (
  <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-base">
    <Text className="text-xs text-ui-fg-subtle uppercase tracking-wide">{label}</Text>
    <Text className="text-2xl font-semibold mt-1">{value}</Text>
    {sub && <Text className="text-xs text-ui-fg-muted mt-0.5">{sub}</Text>}
  </div>
)

/* ================================================================
   OVERVIEW TAB
   ================================================================ */

const OverviewTab = () => {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const [grnRes, pickRes, taskRes] = await Promise.allSettled([
        sdk.client.fetch<{ grn_records?: any[] }>("/admin/warehouse/grn"),
        sdk.client.fetch<{ pick_lists?: any[]; pick_list_lines?: any[] }>("/admin/warehouse/pick-lists"),
        sdk.client.fetch<{ tasks?: WarehouseTask[]; warehouse_tasks?: WarehouseTask[] }>("/admin/warehouse/tasks"),
      ])

      let grnRecords: any[] = []
      let pickLines: any[] = []
      let tasks: WarehouseTask[] = []

      if (grnRes.status === "fulfilled") {
        grnRecords = grnRes.value.grn_records ?? []
      }
      if (pickRes.status === "fulfilled") {
        pickLines = pickRes.value.pick_lists ?? pickRes.value.pick_list_lines ?? []
      }
      if (taskRes.status === "fulfilled") {
        tasks = taskRes.value.tasks ?? taskRes.value.warehouse_tasks ?? []
      }

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      setStats({
        total_warehouses: 1,
        active_zones: 0,
        total_bins: 0,
        pending_tasks: tasks.filter((t) => ["pending", "assigned"].includes(t.status)).length,
        grn_pending_qc: grnRecords.filter((g: any) => g.status === "pending_qc").length,
        pick_lists_pending: pickLines.filter((p: any) => p.status === "pending").length,
        tasks_today: tasks.filter((t) => new Date(t.created_at) >= todayStart).length,
      })
    } catch (err: any) {
      console.error("[warehouse-overview]", err)
      toast.error("Failed to load overview", { description: err.message })
      setStats({
        total_warehouses: 1, active_zones: 0, total_bins: 0,
        pending_tasks: 0, grn_pending_qc: 0, pick_lists_pending: 0, tasks_today: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  if (loading) {
    return <Text className="text-ui-fg-subtle p-4">Loading overview...</Text>
  }

  const s = stats!

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Text className="text-sm font-medium mb-3">Warehouse Summary</Text>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Warehouses" value={s.total_warehouses} sub="Single ambient warehouse" />
          <StatCard label="Active Zones" value={s.active_zones || "—"} sub="Ambient, quarantine, dispatch..." />
          <StatCard label="Total Bins" value={s.total_bins || "—"} sub="Storage locations" />
          <StatCard label="Pending Tasks" value={s.pending_tasks} sub="Awaiting action" />
        </div>
      </div>

      <div>
        <Text className="text-sm font-medium mb-3">Today&apos;s Activity</Text>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Tasks Created Today" value={s.tasks_today} />
          <StatCard label="GRN Pending QC" value={s.grn_pending_qc} sub="Awaiting quality check" />
          <StatCard label="Picks Pending" value={s.pick_lists_pending} sub="Items to be picked" />
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" size="small" onClick={fetchStats}>
          <ArrowPath /> Refresh
        </Button>
      </div>
    </div>
  )
}

/* ================================================================
   TASKS TAB
   ================================================================ */

const TASK_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "receive", label: "Receive" },
  { value: "inspect", label: "Inspect" },
  { value: "put_away", label: "Put Away" },
  { value: "pick", label: "Pick" },
  { value: "pack", label: "Pack" },
  { value: "pre_dispatch_check", label: "Pre-Dispatch Check" },
  { value: "dispatch", label: "Dispatch" },
  { value: "return_inspect", label: "Return Inspect" },
  { value: "cycle_count", label: "Cycle Count" },
]

const TASK_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "exception", label: "Exception" },
]

const TasksTab = () => {
  const [tasks, setTasks] = useState<WarehouseTask[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = {}
      if (statusFilter !== "all") query.status = statusFilter
      if (typeFilter !== "all") query.task_type = typeFilter

      const json = await sdk.client.fetch<{ tasks?: WarehouseTask[]; warehouse_tasks?: WarehouseTask[] }>(
        "/admin/warehouse/tasks",
        { query }
      )
      setTasks(json.tasks ?? json.warehouse_tasks ?? [])
    } catch (err: any) {
      console.error("[warehouse-tasks]", err)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleStatusChange = async (taskId: string, newStatus: "in_progress" | "completed") => {
    setUpdating(taskId)
    try {
      await sdk.client.fetch<{ success: boolean }>(`/admin/warehouse/tasks/${taskId}`, {
        method: "POST",
        body: {
          status: newStatus,
          ...(newStatus === "in_progress" ? { started_at: new Date().toISOString() } : {}),
          ...(newStatus === "completed" ? { completed_at: new Date().toISOString() } : {}),
        },
      })
      toast.success(`Task ${newStatus === "in_progress" ? "started" : "completed"}`)
      fetchTasks()
    } catch (err: any) {
      toast.error("Failed to update task", { description: err.message })
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Text className="text-xs text-ui-fg-subtle mb-1">Task Type</Text>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
            <Select.Trigger><Select.Value placeholder="All Types" /></Select.Trigger>
            <Select.Content>
              {TASK_TYPE_OPTIONS.map((o) => (
                <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="w-48">
          <Text className="text-xs text-ui-fg-subtle mb-1">Status</Text>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
            <Select.Trigger><Select.Value placeholder="All Statuses" /></Select.Trigger>
            <Select.Content>
              {TASK_STATUS_OPTIONS.map((o) => (
                <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <Button variant="secondary" size="small" onClick={fetchTasks}>
          <ArrowPath /> Refresh
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading tasks...</Text>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Text className="text-ui-fg-subtle mb-1">No warehouse tasks found.</Text>
          <Text className="text-xs text-ui-fg-muted">
            Tasks are created automatically when orders are placed or GRNs received.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Priority</Table.HeaderCell>
              <Table.HeaderCell>Assigned To</Table.HeaderCell>
              <Table.HeaderCell>Reference</Table.HeaderCell>
              <Table.HeaderCell>Created</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {tasks.map((task) => (
              <Table.Row key={task.id}>
                <Table.Cell>
                  <Badge color={taskTypeColor(task.task_type)}>{cap(task.task_type)}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={statusColor(task.status)}>{cap(task.status)}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={priorityColor(task.priority)}>{cap(task.priority)}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm">{task.assigned_to || "Unassigned"}</Text>
                </Table.Cell>
                <Table.Cell>
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">{cap(task.reference_type)}</Text>
                    <Text className="text-sm font-mono">{task.reference_id?.slice(-12) || "—"}</Text>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle">{fmtDateTime(task.created_at)}</Text>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex gap-1">
                    {(task.status === "pending" || task.status === "assigned") && (
                      <Button
                        variant="secondary"
                        size="small"
                        disabled={updating === task.id}
                        onClick={() => handleStatusChange(task.id, "in_progress")}
                      >
                        Start
                      </Button>
                    )}
                    {task.status === "in_progress" && (
                      <Button
                        variant="primary"
                        size="small"
                        disabled={updating === task.id}
                        onClick={() => handleStatusChange(task.id, "completed")}
                      >
                        <CheckCircleSolid /> Complete
                      </Button>
                    )}
                    {task.status === "completed" && (
                      <Text className="text-xs text-ui-fg-muted self-center">
                        {fmtDateTime(task.completed_at)}
                      </Text>
                    )}
                    {task.status === "exception" && task.exception_notes && (
                      <Text className="text-xs text-ui-fg-error self-center truncate max-w-[150px]" title={task.exception_notes}>
                        {task.exception_notes}
                      </Text>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  )
}

/* ================================================================
   PICK LISTS TAB
   ================================================================ */

const PICK_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "picked", label: "Picked" },
  { value: "short_pick", label: "Short Pick" },
  { value: "exception", label: "Exception" },
]

const PickListsTab = () => {
  const [lines, setLines] = useState<PickListLine[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [generating, setGenerating] = useState(false)

  const fetchPickLists = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = {}
      if (statusFilter !== "all") query.status = statusFilter

      const json = await sdk.client.fetch<{ pick_lists?: PickListLine[]; pick_list_lines?: PickListLine[] }>(
        "/admin/warehouse/pick-lists",
        { query }
      )
      setLines(json.pick_lists ?? json.pick_list_lines ?? [])
    } catch (err: any) {
      console.error("[warehouse-pick-lists]", err)
      setLines([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchPickLists() }, [fetchPickLists])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const json = await sdk.client.fetch<{ lines_created?: number }>("/admin/warehouse/pick-lists", {
        method: "POST",
        body: { action: "generate" },
      })
      toast.success(`Pick list generated — ${json.lines_created ?? 0} line(s)`)
      fetchPickLists()
    } catch (err: any) {
      toast.error("Failed to generate pick list", { description: err.message })
    } finally {
      setGenerating(false)
    }
  }

  const handleMarkPicked = async (lineId: string) => {
    try {
      await sdk.client.fetch<{ success: boolean }>("/admin/warehouse/pick-lists", {
        method: "POST",
        body: {
          action: "mark_picked",
          line_id: lineId,
          picked_at: new Date().toISOString(),
        },
      })
      toast.success("Line marked as picked")
      fetchPickLists()
    } catch (err: any) {
      toast.error("Failed to update", { description: err.message })
    }
  }

  // Group pick lines by task_id for display
  const taskGroups = lines.reduce<Record<string, PickListLine[]>>((acc, line) => {
    const key = line.task_id || "unassigned"
    if (!acc[key]) acc[key] = []
    acc[key].push(line)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex items-end gap-3">
          <div className="w-48">
            <Text className="text-xs text-ui-fg-subtle mb-1">Status</Text>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <Select.Trigger><Select.Value placeholder="All Statuses" /></Select.Trigger>
              <Select.Content>
                {PICK_STATUS_OPTIONS.map((o) => (
                  <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <Button variant="secondary" size="small" onClick={fetchPickLists}>
            <ArrowPath /> Refresh
          </Button>
        </div>
        <Button variant="primary" size="small" onClick={handleGenerate} disabled={generating}>
          <PlusMini /> {generating ? "Generating..." : "Generate Pick List"}
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading pick lists...</Text>
      ) : lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Text className="text-ui-fg-subtle mb-1">No pick list lines found.</Text>
          <Text className="text-xs text-ui-fg-muted">
            Click &quot;Generate Pick List&quot; to create picks for pending orders.
          </Text>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(taskGroups).map(([taskId, groupLines]) => (
            <div key={taskId} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-ui-bg-subtle border-b">
                <div className="flex items-center gap-2">
                  <Text className="text-sm font-medium">Task</Text>
                  <Text className="text-xs font-mono text-ui-fg-subtle">
                    {taskId === "unassigned" ? "Unassigned" : taskId.slice(-12)}
                  </Text>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color="grey">{groupLines.length} line(s)</Badge>
                  <Badge color={groupLines.every((l) => l.status === "picked") ? "green" : "orange"}>
                    {groupLines.filter((l) => l.status === "picked").length}/{groupLines.length} picked
                  </Badge>
                </div>
              </div>
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Bin</Table.HeaderCell>
                    <Table.HeaderCell>Batch</Table.HeaderCell>
                    <Table.HeaderCell>Order Item</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">To Pick</Table.HeaderCell>
                    <Table.HeaderCell className="text-right">Picked</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {groupLines.map((line) => (
                    <Table.Row key={line.id}>
                      <Table.Cell>
                        <Text className="text-sm font-mono">{line.bin_id?.slice(-8) || "—"}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text className="text-sm font-mono">{line.batch_id?.slice(-8) || "—"}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text className="text-sm font-mono">{line.order_item_id?.slice(-8) || "—"}</Text>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Text className="text-sm font-medium">{line.quantity_to_pick}</Text>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Text className="text-sm">{line.quantity_picked}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={pickStatusColor(line.status)}>{cap(line.status)}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {line.status === "pending" && (
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => handleMarkPicked(line.id)}
                          >
                            <CheckCircleSolid /> Pick
                          </Button>
                        )}
                        {line.status === "picked" && (
                          <Text className="text-xs text-ui-fg-muted">{fmtDateTime(line.picked_at)}</Text>
                        )}
                        {line.status === "exception" && line.exception_reason && (
                          <Text className="text-xs text-ui-fg-error truncate max-w-[120px]" title={line.exception_reason}>
                            {line.exception_reason}
                          </Text>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

const WarehousePage = () => {
  return (
    <div className="flex flex-col gap-4">
      <Container className="p-6">
        <Heading level="h1" className="mb-2">Warehouse Management</Heading>
        <Text className="text-ui-fg-subtle">
          Monitor warehouse operations — tasks, pick lists, and inventory flow.
          Single ambient warehouse for tablets, capsules, syrups, and strips.
        </Text>
      </Container>

      <Container className="p-6">
        <Tabs defaultValue="overview">
          <Tabs.List>
            <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
            <Tabs.Trigger value="tasks">Tasks</Tabs.Trigger>
            <Tabs.Trigger value="pick-lists">Pick Lists</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="overview" className="pt-4">
            <OverviewTab />
          </Tabs.Content>

          <Tabs.Content value="tasks" className="pt-4">
            <TasksTab />
          </Tabs.Content>

          <Tabs.Content value="pick-lists" className="pt-4">
            <PickListsTab />
          </Tabs.Content>
        </Tabs>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Warehouse",
  icon: CommandLineSolid,
})

export default WarehousePage
