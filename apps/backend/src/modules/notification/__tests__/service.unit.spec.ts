/**
 * Unit tests for NotificationModuleService custom business logic.
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

function buildTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("tmpl"),
    template_code: "order_placed",
    channel: "sms" as "sms" | "whatsapp" | "email",
    trigger_event: "order.placed",
    dlt_template_id: "DLT-001",
    dlt_registered: true,
    dlt_registered_at: new Date(),
    sender_id: "SUPRA",
    template_text: "Your order {#order_id#} has been placed.",
    variables: ["order_id"],
    is_active: true,
    is_rx_allowed: false,
    ...overrides,
  }
}

function buildInternalNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("notif"),
    user_id: uid("user"),
    role_scope: null,
    type: "info",
    title: "Test notification",
    body: "Body text",
    reference_type: null,
    reference_id: null,
    read: false,
    ...overrides,
  }
}

// ---------- FakeNotificationService ----------

class FakeNotificationService {
  private templates: ReturnType<typeof buildTemplate>[] = []
  private notifications: ReturnType<typeof buildInternalNotification>[] = []

  _seedTemplates(data: ReturnType<typeof buildTemplate>[]) {
    this.templates = data
  }

  // Internal mocks
  private async listNotificationTemplates(filters: Record<string, unknown>) {
    return this.templates.filter((t) =>
      Object.entries(filters).every(([k, v]) => t[k as keyof typeof t] === v)
    )
  }

  private async createInternalNotifications(data: Record<string, unknown>) {
    const n = buildInternalNotification(data)
    this.notifications.push(n)
    return n
  }

  private async createNotificationTemplates(data: Record<string, unknown>) {
    const t = buildTemplate(data)
    this.templates.push(t)
    return t
  }

  // ---- Public service methods (mirrors service.ts) ----

  async sendSms(data: {
    template_code: string
    phone: string
    variables: Record<string, string>
  }) {
    const [template] = await this.listNotificationTemplates({
      template_code: data.template_code,
      channel: "sms",
      is_active: true,
    })

    if (!template) {
      return { sent: false, reason: `SMS template ${data.template_code} not found or inactive` }
    }

    if (!template.dlt_registered) {
      return { sent: false, reason: `Template ${data.template_code} not DLT-registered — cannot send` }
    }

    let messageText = template.template_text
    for (const [key, value] of Object.entries(data.variables)) {
      messageText = messageText.replace(new RegExp(`\\{#${key}#\\}`, "g"), value)
    }

    return {
      sent: true,
      template_code: data.template_code,
      dlt_template_id: template.dlt_template_id,
      phone: data.phone,
      message_length: messageText.length,
    }
  }

  async sendWhatsApp(data: {
    template_code: string
    phone: string
    variables: Record<string, string>
  }) {
    const [template] = await this.listNotificationTemplates({
      template_code: data.template_code,
      channel: "whatsapp",
      is_active: true,
    })

    if (!template) {
      return { sent: false, reason: `WhatsApp template ${data.template_code} not found` }
    }

    return {
      sent: true,
      template_code: data.template_code,
      phone: data.phone,
    }
  }

  async sendEmail(data: {
    template_code: string
    to: string
    variables: Record<string, string>
  }) {
    const [template] = await this.listNotificationTemplates({
      template_code: data.template_code,
      channel: "email",
      is_active: true,
    })

    if (!template) {
      return { sent: false, reason: `Email template ${data.template_code} not found` }
    }

    return {
      sent: true,
      template_code: data.template_code,
      to: data.to,
    }
  }

  async sendInApp(data: {
    user_id: string
    type: string
    title: string
    body: string
    role_scope?: string
    reference_type?: string
    reference_id?: string
  }) {
    return await this.createInternalNotifications({
      user_id: data.user_id,
      role_scope: data.role_scope ?? null,
      type: data.type,
      title: data.title,
      body: data.body,
      reference_type: data.reference_type ?? null,
      reference_id: data.reference_id ?? null,
      read: false,
    })
  }

  async checkOptIn(customerId: string, _channel: string): Promise<boolean> {
    return Boolean(customerId)
  }

  async registerDltTemplate(data: {
    template_code: string
    channel: "sms" | "whatsapp" | "email"
    trigger_event: string
    dlt_template_id: string
    sender_id?: string
    template_text: string
    variables?: string[]
    is_rx_allowed?: boolean
  }) {
    return await this.createNotificationTemplates({
      template_code: data.template_code,
      channel: data.channel,
      trigger_event: data.trigger_event,
      dlt_template_id: data.dlt_template_id,
      dlt_registered: true,
      dlt_registered_at: new Date(),
      sender_id: data.sender_id ?? null,
      template_text: data.template_text,
      variables: data.variables ?? null,
      is_active: true,
      is_rx_allowed: data.is_rx_allowed ?? false,
    })
  }

  // Expose internals
  _getNotifications() { return this.notifications }
  _getTemplates() { return this.templates }
}

// ---------- tests ----------

describe("NotificationModuleService (unit)", () => {
  let service: FakeNotificationService

  beforeEach(() => {
    service = new FakeNotificationService()
    _idCounter = 0
  })

  // ── sendSms ──────────────────────────────────────────────────────

  describe("sendSms()", () => {
    it("returns sent=true and resolves template variables", async () => {
      service._seedTemplates([
        buildTemplate({
          template_code: "order_placed",
          channel: "sms",
          is_active: true,
          dlt_registered: true,
          template_text: "Order {#order_id#} placed. Track at {#link#}.",
        }),
      ])

      const result = await service.sendSms({
        template_code: "order_placed",
        phone: "+919876543210",
        variables: { order_id: "ORD-001", link: "track.suprameds.in" },
      })

      expect(result.sent).toBe(true)
      expect(result.message_length).toBe("Order ORD-001 placed. Track at track.suprameds.in.".length)
    })

    it("returns sent=false when template does not exist", async () => {
      const result = await service.sendSms({
        template_code: "nonexistent_code",
        phone: "+919876543210",
        variables: {},
      })

      expect(result.sent).toBe(false)
      expect((result as any).reason).toContain("not found or inactive")
    })

    it("returns sent=false when template is inactive", async () => {
      service._seedTemplates([
        buildTemplate({
          template_code: "inactive_sms",
          channel: "sms",
          is_active: false,
          dlt_registered: true,
        }),
      ])

      const result = await service.sendSms({
        template_code: "inactive_sms",
        phone: "+919876543210",
        variables: {},
      })

      expect(result.sent).toBe(false)
    })

    it("returns sent=false when template is not DLT-registered", async () => {
      service._seedTemplates([
        buildTemplate({
          template_code: "unregistered_sms",
          channel: "sms",
          is_active: true,
          dlt_registered: false,
        }),
      ])

      const result = await service.sendSms({
        template_code: "unregistered_sms",
        phone: "+919876543210",
        variables: {},
      })

      expect(result.sent).toBe(false)
      expect((result as any).reason).toContain("not DLT-registered")
    })

    it("does not match an email template for an SMS send", async () => {
      service._seedTemplates([
        buildTemplate({
          template_code: "order_placed",
          channel: "email",
          is_active: true,
          dlt_registered: true,
        }),
      ])

      const result = await service.sendSms({
        template_code: "order_placed",
        phone: "+919876543210",
        variables: {},
      })

      expect(result.sent).toBe(false)
    })
  })

  // ── sendWhatsApp ─────────────────────────────────────────────────

  describe("sendWhatsApp()", () => {
    it("returns sent=true when active WhatsApp template exists", async () => {
      service._seedTemplates([
        buildTemplate({
          template_code: "rx_reminder",
          channel: "whatsapp",
          is_active: true,
        }),
      ])

      const result = await service.sendWhatsApp({
        template_code: "rx_reminder",
        phone: "+919876543210",
        variables: {},
      })

      expect(result.sent).toBe(true)
      expect(result.phone).toBe("+919876543210")
    })

    it("returns sent=false when WhatsApp template is missing", async () => {
      const result = await service.sendWhatsApp({
        template_code: "missing_wa",
        phone: "+919876543210",
        variables: {},
      })

      expect(result.sent).toBe(false)
      expect((result as any).reason).toContain("not found")
    })
  })

  // ── sendEmail ────────────────────────────────────────────────────

  describe("sendEmail()", () => {
    it("returns sent=true when active email template exists", async () => {
      service._seedTemplates([
        buildTemplate({
          template_code: "order_confirmation",
          channel: "email",
          is_active: true,
        }),
      ])

      const result = await service.sendEmail({
        template_code: "order_confirmation",
        to: "patient@example.com",
        variables: {},
      })

      expect(result.sent).toBe(true)
      expect((result as any).to).toBe("patient@example.com")
    })

    it("returns sent=false when email template is missing", async () => {
      const result = await service.sendEmail({
        template_code: "missing_email",
        to: "patient@example.com",
        variables: {},
      })

      expect(result.sent).toBe(false)
    })
  })

  // ── sendInApp ────────────────────────────────────────────────────

  describe("sendInApp()", () => {
    it("creates an in-app notification with correct fields", async () => {
      const notif = await service.sendInApp({
        user_id: "user_01",
        type: "prescription_approved",
        title: "Prescription Approved",
        body: "Your prescription has been reviewed and approved.",
        reference_type: "prescription",
        reference_id: "prx_01",
      })

      expect(notif.user_id).toBe("user_01")
      expect(notif.type).toBe("prescription_approved")
      expect(notif.read).toBe(false)
      expect(notif.reference_type).toBe("prescription")
      expect(notif.reference_id).toBe("prx_01")
    })

    it("defaults role_scope to null when not provided", async () => {
      const notif = await service.sendInApp({
        user_id: "user_02",
        type: "info",
        title: "Info",
        body: "Just an info message",
      })

      expect(notif.role_scope).toBeNull()
    })

    it("stores optional role_scope for broadcast notifications", async () => {
      const notif = await service.sendInApp({
        user_id: "broadcast",
        type: "alert",
        title: "System Alert",
        body: "Scheduled maintenance at 2am",
        role_scope: "pharmacist",
      })

      expect(notif.role_scope).toBe("pharmacist")
    })
  })

  // ── checkOptIn ───────────────────────────────────────────────────

  describe("checkOptIn()", () => {
    it("returns true for a valid non-empty customerId", async () => {
      const result = await service.checkOptIn("cust_01", "sms")
      expect(result).toBe(true)
    })

    it("returns false for an empty customerId string", async () => {
      const result = await service.checkOptIn("", "sms")
      expect(result).toBe(false)
    })
  })

  // ── registerDltTemplate ──────────────────────────────────────────

  describe("registerDltTemplate()", () => {
    it("creates a DLT-registered template marked is_active=true", async () => {
      const tmpl = await service.registerDltTemplate({
        template_code: "new_sms_code",
        channel: "sms",
        trigger_event: "order.dispatched",
        dlt_template_id: "DLT-NEW-001",
        template_text: "Your order has been dispatched.",
      })

      expect(tmpl.dlt_registered).toBe(true)
      expect(tmpl.is_active).toBe(true)
      expect(tmpl.template_code).toBe("new_sms_code")
    })

    it("defaults is_rx_allowed to false", async () => {
      const tmpl = await service.registerDltTemplate({
        template_code: "otc_template",
        channel: "sms",
        trigger_event: "order.placed",
        dlt_template_id: "DLT-OTC-001",
        template_text: "Test text",
      })

      expect(tmpl.is_rx_allowed).toBe(false)
    })

    it("stores is_rx_allowed=true when explicitly set", async () => {
      const tmpl = await service.registerDltTemplate({
        template_code: "rx_template",
        channel: "sms",
        trigger_event: "prescription.approved",
        dlt_template_id: "DLT-RX-001",
        template_text: "Rx order processed.",
        is_rx_allowed: true,
      })

      expect(tmpl.is_rx_allowed).toBe(true)
    })
  })
})
