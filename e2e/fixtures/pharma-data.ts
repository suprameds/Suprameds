/**
 * Shared pharma test fixtures — domain-specific data for security, smoke, and a11y tests.
 * Auth credentials and URLs live in test-data.ts; this file has drug/batch/prescription data.
 */

// ─── PRODUCTS ───

export const PRODUCTS = {
  genericRx: {
    id: "prod_atorvastatin_20",
    title: "Atorvastatin 20mg",
    handle: "atorvastatin-20mg",
    subtitle: "Atorvastatin Calcium",
    metadata: {
      salt_composition: "Atorvastatin Calcium 20mg",
      drug_schedule: "H",
      manufacturer: "Cipla Ltd",
      dosage_form: "Tablet",
      pack_size: 10,
      requires_prescription: true,
      branded_equivalent: "Lipitor 20mg",
      branded_mrp: 18700,
    },
    variants: [
      {
        id: "var_atorvastatin_20_10",
        title: "Strip of 10 Tablets",
        sku: "ATOR20-10",
        prices: [{ amount: 4200, currency_code: "inr" }],
        inventory_quantity: 150,
        metadata: {
          batch_number: "BATCH-2025-A412",
          mfg_date: "2025-01-15",
          exp_date: "2027-01-14",
        },
      },
    ],
  },

  otcProduct: {
    id: "prod_paracetamol_650",
    title: "Paracetamol 650mg",
    handle: "paracetamol-650mg",
    subtitle: "Paracetamol IP",
    metadata: {
      salt_composition: "Paracetamol 650mg",
      drug_schedule: "OTC",
      manufacturer: "Sun Pharma",
      dosage_form: "Tablet",
      pack_size: 15,
      requires_prescription: false,
    },
    variants: [
      {
        id: "var_paracetamol_650_15",
        title: "Strip of 15 Tablets",
        sku: "PCM650-15",
        prices: [{ amount: 1200, currency_code: "inr" }],
        inventory_quantity: 500,
      },
    ],
  },

  scheduleH1Drug: {
    id: "prod_azithromycin_500",
    title: "Azithromycin 500mg",
    handle: "azithromycin-500mg",
    metadata: {
      salt_composition: "Azithromycin 500mg",
      drug_schedule: "H1",
      manufacturer: "Alkem Laboratories",
      requires_prescription: true,
      h1_register_required: true,
    },
    variants: [
      {
        id: "var_azithro_500_3",
        title: "Strip of 3 Tablets",
        sku: "AZTH500-3",
        prices: [{ amount: 6800, currency_code: "inr" }],
        inventory_quantity: 80,
      },
    ],
  },

  scheduleXDrug: {
    id: "prod_schedule_x_blocked",
    title: "Schedule X Drug (BLOCKED)",
    metadata: {
      drug_schedule: "X",
      requires_prescription: true,
      blocked: true,
    },
  },
}

// ─── CUSTOMERS ───

export const CUSTOMERS = {
  verified: {
    id: "cust_verified_01",
    email: "rajesh.kumar@example.com",
    first_name: "Rajesh",
    last_name: "Kumar",
    phone: "+919876543210",
    metadata: { kyc_verified: true, address_pincode: "500072", state: "Telangana" },
  },
  unverified: {
    id: "cust_new_01",
    email: "new.user@example.com",
    first_name: "Priya",
    last_name: "Sharma",
    phone: "+919988776655",
    metadata: { kyc_verified: false },
  },
}

// ─── PRESCRIPTIONS ───

export const PRESCRIPTIONS = {
  valid: {
    id: "rx_valid_01",
    customer_id: "cust_verified_01",
    doctor_name: "Dr. Anil Mehta",
    doctor_registration: "MCI/2015/12345",
    hospital_name: "Apollo Hospitals",
    prescription_date: "2025-03-15",
    drugs: [{ name: "Atorvastatin 20mg", dosage: "1 tablet daily at bedtime", duration: "3 months", quantity: 90 }],
    file_url: "/uploads/rx/rx_valid_01.pdf",
    status: "approved",
  },
  expired: {
    id: "rx_expired_01",
    customer_id: "cust_verified_01",
    prescription_date: "2024-12-01",
    status: "expired",
  },
  invalidDoctor: {
    id: "rx_invalid_doc_01",
    doctor_name: "Not A Doctor",
    doctor_registration: "INVALID_REG",
    status: "rejected",
    rejection_reason: "Invalid doctor registration number",
  },
}

// ─── BATCH DATA (FEFO allocation) ───

export const BATCHES = {
  fresh: { batch_number: "BATCH-2025-A412", mfg_date: "2025-01-15", exp_date: "2027-01-14", quantity: 150 },
  expiringSoon: { batch_number: "BATCH-2024-B108", mfg_date: "2024-01-10", exp_date: "2025-04-10", quantity: 20 },
  expired: { batch_number: "BATCH-2023-C001", mfg_date: "2023-01-01", exp_date: "2024-12-31", quantity: 5 },
}

// ─── ADDRESSES ───

export const ADDRESSES = {
  hyderabad: {
    first_name: "Rajesh",
    last_name: "Kumar",
    address_1: "#42, Banjara Hills Road No. 12",
    city: "Hyderabad",
    province: "Telangana",
    postal_code: "500034",
    country_code: "in",
    phone: "+919876543210",
  },
  vizag: {
    first_name: "Swetha",
    last_name: "M",
    address_1: "Flat 301, Sea View Apartments",
    city: "Visakhapatnam",
    province: "Andhra Pradesh",
    postal_code: "530003",
    country_code: "in",
    phone: "+919988776655",
  },
}

// ─── API SCHEMAS (contract testing) ───

export const API_SCHEMAS = {
  productResponse: {
    required: ["id", "title", "handle", "variants"],
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      handle: { type: "string" },
      variants: { type: "array" },
      metadata: {
        type: "object",
        properties: {
          drug_schedule: { type: "string", enum: ["OTC", "H", "H1"] },
          requires_prescription: { type: "boolean" },
          salt_composition: { type: "string" },
        },
      },
    },
  },
}
