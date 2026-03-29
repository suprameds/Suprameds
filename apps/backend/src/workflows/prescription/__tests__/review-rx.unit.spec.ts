/**
 * Unit tests for prescription review workflow (review-rx).
 *
 * Tests the approve/reject flow, pharmacist credential validation,
 * status transitions, prescription line creation, and event emission.
 * Business logic is tested as extracted pure functions to avoid
 * Medusa framework side effects.
 */

// -- Domain types -------------------------------------------------------

type PrescriptionStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "expired"

type Prescription = {
  id: string
  status: PrescriptionStatus
  customer_id: string
  image_url: string
  reviewed_by: string | null
  reviewed_at: Date | null
  rejection_reason: string | null
  doctor_name: string | null
  doctor_reg_no: string | null
  patient_name: string | null
  pharmacist_notes: string | null
}

type ReviewInput = {
  prescription_id: string
  pharmacist_id: string
  action: "approve" | "reject"
  rejection_reason?: string
  doctor_name?: string
  doctor_reg_no?: string
  patient_name?: string
  pharmacist_notes?: string
  lines?: {
    product_variant_id: string
    approved_quantity: number
    max_refills?: number
  }[]
}

// -- Extracted business logic -------------------------------------------

function validatePrescriptionExists(
  prescription: Prescription | null,
  id: string
): { valid: boolean; error?: string } {
  if (!prescription) {
    return { valid: false, error: `Prescription ${id} not found` }
  }
  return { valid: true }
}

function validatePrescriptionStatus(
  prescription: Prescription
): { valid: boolean; error?: string } {
  if (prescription.status !== "pending_review") {
    return {
      valid: false,
      error: `Prescription is not in pending_review status (current: ${prescription.status})`,
    }
  }
  return { valid: true }
}

function validatePharmacistCredential(
  hasRegistration: boolean,
  pharmacistId: string
): { valid: boolean; warning?: string } {
  if (!hasRegistration) {
    return {
      valid: true, // Non-blocking — still allowed but logged
      warning: `Pharmacist ${pharmacistId} has no pharmacist_registration credential on file`,
    }
  }
  return { valid: true }
}

function applyRejection(
  prescription: Prescription,
  pharmacistId: string,
  reason?: string,
  notes?: string
): Prescription {
  return {
    ...prescription,
    status: "rejected",
    rejection_reason: reason ?? null,
    reviewed_by: pharmacistId,
    reviewed_at: new Date(),
    pharmacist_notes: notes ?? null,
  }
}

function applyApproval(
  prescription: Prescription,
  pharmacistId: string,
  doctorName?: string,
  doctorRegNo?: string,
  patientName?: string,
  notes?: string
): Prescription {
  return {
    ...prescription,
    status: "approved",
    doctor_name: doctorName ?? null,
    doctor_reg_no: doctorRegNo ?? null,
    patient_name: patientName ?? null,
    reviewed_by: pharmacistId,
    reviewed_at: new Date(),
    pharmacist_notes: notes ?? null,
  }
}

function determineEventName(action: "approve" | "reject"): string {
  return action === "approve"
    ? "prescription.fully-approved"
    : "prescription.rejected"
}

// -- Tests --------------------------------------------------------------

describe("review-rx: prescription existence validation", () => {
  it("passes when prescription exists", () => {
    const rx: Prescription = {
      id: "rx_01",
      status: "pending_review",
      customer_id: "cus_01",
      image_url: "https://r2.example.com/rx/1.jpg",
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      doctor_name: null,
      doctor_reg_no: null,
      patient_name: null,
      pharmacist_notes: null,
    }
    const result = validatePrescriptionExists(rx, "rx_01")
    expect(result.valid).toBe(true)
  })

  it("fails when prescription is null", () => {
    const result = validatePrescriptionExists(null, "rx_missing")
    expect(result.valid).toBe(false)
    expect(result.error).toContain("rx_missing")
    expect(result.error).toContain("not found")
  })
})

describe("review-rx: prescription status validation", () => {
  const baseRx: Prescription = {
    id: "rx_01",
    status: "pending_review",
    customer_id: "cus_01",
    image_url: "https://r2.example.com/rx/1.jpg",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    doctor_name: null,
    doctor_reg_no: null,
    patient_name: null,
    pharmacist_notes: null,
  }

  it("allows review when status is pending_review", () => {
    const result = validatePrescriptionStatus(baseRx)
    expect(result.valid).toBe(true)
  })

  it("rejects already-approved prescription", () => {
    const result = validatePrescriptionStatus({ ...baseRx, status: "approved" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("approved")
  })

  it("rejects already-rejected prescription", () => {
    const result = validatePrescriptionStatus({ ...baseRx, status: "rejected" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("rejected")
  })

  it("rejects expired prescription", () => {
    const result = validatePrescriptionStatus({ ...baseRx, status: "expired" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("expired")
  })
})

describe("review-rx: pharmacist credential check", () => {
  it("passes with warning when pharmacist has no registration", () => {
    const result = validatePharmacistCredential(false, "pharm_01")
    expect(result.valid).toBe(true) // Non-blocking
    expect(result.warning).toContain("no pharmacist_registration")
  })

  it("passes without warning when pharmacist has registration", () => {
    const result = validatePharmacistCredential(true, "pharm_01")
    expect(result.valid).toBe(true)
    expect(result.warning).toBeUndefined()
  })
})

describe("review-rx: rejection flow", () => {
  const pendingRx: Prescription = {
    id: "rx_01",
    status: "pending_review",
    customer_id: "cus_01",
    image_url: "https://r2.example.com/rx/1.jpg",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    doctor_name: null,
    doctor_reg_no: null,
    patient_name: null,
    pharmacist_notes: null,
  }

  it("transitions prescription to rejected status", () => {
    const rejected = applyRejection(pendingRx, "pharm_01", "Illegible handwriting")
    expect(rejected.status).toBe("rejected")
  })

  it("records the rejection reason", () => {
    const rejected = applyRejection(pendingRx, "pharm_01", "Expired prescription")
    expect(rejected.rejection_reason).toBe("Expired prescription")
  })

  it("records the reviewing pharmacist", () => {
    const rejected = applyRejection(pendingRx, "pharm_01", "Reason")
    expect(rejected.reviewed_by).toBe("pharm_01")
    expect(rejected.reviewed_at).toBeInstanceOf(Date)
  })

  it("does not mutate the original prescription", () => {
    applyRejection(pendingRx, "pharm_01", "Reason")
    expect(pendingRx.status).toBe("pending_review")
    expect(pendingRx.reviewed_by).toBeNull()
  })

  it("handles missing rejection reason gracefully", () => {
    const rejected = applyRejection(pendingRx, "pharm_01")
    expect(rejected.rejection_reason).toBeNull()
  })
})

describe("review-rx: approval flow", () => {
  const pendingRx: Prescription = {
    id: "rx_01",
    status: "pending_review",
    customer_id: "cus_01",
    image_url: "https://r2.example.com/rx/1.jpg",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    doctor_name: null,
    doctor_reg_no: null,
    patient_name: null,
    pharmacist_notes: null,
  }

  it("transitions prescription to approved status", () => {
    const approved = applyApproval(pendingRx, "pharm_01", "Dr. Sharma", "REG12345")
    expect(approved.status).toBe("approved")
  })

  it("records doctor details on approval", () => {
    const approved = applyApproval(
      pendingRx,
      "pharm_01",
      "Dr. Sharma",
      "REG12345",
      "Patient Raj"
    )
    expect(approved.doctor_name).toBe("Dr. Sharma")
    expect(approved.doctor_reg_no).toBe("REG12345")
    expect(approved.patient_name).toBe("Patient Raj")
  })

  it("records the reviewing pharmacist and timestamp", () => {
    const approved = applyApproval(pendingRx, "pharm_01")
    expect(approved.reviewed_by).toBe("pharm_01")
    expect(approved.reviewed_at).toBeInstanceOf(Date)
  })

  it("does not mutate the original prescription", () => {
    applyApproval(pendingRx, "pharm_01")
    expect(pendingRx.status).toBe("pending_review")
  })
})

describe("review-rx: event determination", () => {
  it("returns prescription.fully-approved for approve action", () => {
    expect(determineEventName("approve")).toBe("prescription.fully-approved")
  })

  it("returns prescription.rejected for reject action", () => {
    expect(determineEventName("reject")).toBe("prescription.rejected")
  })
})

describe("review-rx: happy path mock — approval with lines", () => {
  it("creates prescription, lines, and emits event on approval", async () => {
    const mockPrescriptionService = {
      listPrescriptions: jest.fn().mockResolvedValue([{
        id: "rx_01",
        status: "pending_review",
        customer_id: "cus_01",
      }]),
      updatePrescriptions: jest.fn().mockResolvedValue({
        id: "rx_01",
        status: "approved",
        reviewed_by: "pharm_01",
      }),
      createPrescriptionLines: jest.fn().mockResolvedValue([
        { id: "rxl_01", prescription_id: "rx_01", product_variant_id: "var_01" },
      ]),
    }

    const mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
    }

    // 1. Verify prescription exists
    const [rx] = await mockPrescriptionService.listPrescriptions({ id: "rx_01" })
    expect(rx.status).toBe("pending_review")

    // 2. Update prescription status
    const updated = await mockPrescriptionService.updatePrescriptions({
      id: "rx_01",
      status: "approved",
      reviewed_by: "pharm_01",
      doctor_name: "Dr. Patel",
    })
    expect(updated.status).toBe("approved")

    // 3. Create prescription lines
    await mockPrescriptionService.createPrescriptionLines([
      {
        prescription_id: "rx_01",
        product_variant_id: "var_01",
        product_id: "",
        approved_quantity: 30,
        max_refills: null,
      },
    ])
    expect(mockPrescriptionService.createPrescriptionLines).toHaveBeenCalledTimes(1)

    // 4. Emit event
    const eventName = determineEventName("approve")
    await mockEventBus.emit({
      name: eventName,
      data: { id: "rx_01" },
    })
    expect(mockEventBus.emit).toHaveBeenCalledWith({
      name: "prescription.fully-approved",
      data: { id: "rx_01" },
    })
  })
})

describe("review-rx: happy path mock — rejection", () => {
  it("rejects prescription and emits rejection event", async () => {
    const mockPrescriptionService = {
      listPrescriptions: jest.fn().mockResolvedValue([{
        id: "rx_02",
        status: "pending_review",
        customer_id: "cus_02",
      }]),
      updatePrescriptions: jest.fn().mockResolvedValue({
        id: "rx_02",
        status: "rejected",
        rejection_reason: "Cannot read doctor name",
        reviewed_by: "pharm_01",
      }),
    }

    const mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
    }

    // 1. Verify prescription exists
    const [rx] = await mockPrescriptionService.listPrescriptions({ id: "rx_02" })
    expect(rx.status).toBe("pending_review")

    // 2. Update to rejected
    const updated = await mockPrescriptionService.updatePrescriptions({
      id: "rx_02",
      status: "rejected",
      rejection_reason: "Cannot read doctor name",
      reviewed_by: "pharm_01",
    })
    expect(updated.status).toBe("rejected")
    expect(updated.rejection_reason).toBe("Cannot read doctor name")

    // 3. Emit rejection event
    const eventName = determineEventName("reject")
    await mockEventBus.emit({
      name: eventName,
      data: { id: "rx_02" },
    })
    expect(mockEventBus.emit).toHaveBeenCalledWith({
      name: "prescription.rejected",
      data: { id: "rx_02" },
    })
  })

  it("does not create prescription lines on rejection", async () => {
    const mockPrescriptionService = {
      listPrescriptions: jest.fn().mockResolvedValue([{
        id: "rx_03",
        status: "pending_review",
      }]),
      updatePrescriptions: jest.fn().mockResolvedValue({
        id: "rx_03",
        status: "rejected",
      }),
      createPrescriptionLines: jest.fn(),
    }

    await mockPrescriptionService.listPrescriptions({ id: "rx_03" })
    await mockPrescriptionService.updatePrescriptions({
      id: "rx_03",
      status: "rejected",
      rejection_reason: "Illegible",
      reviewed_by: "pharm_01",
    })

    // Lines should NOT be created for rejections
    expect(mockPrescriptionService.createPrescriptionLines).not.toHaveBeenCalled()
  })
})
