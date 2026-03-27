export const TEST_CUSTOMER = {
  email: "test-e2e@suprameds.test",
  password: "TestPass123!",
  first_name: "Test",
  last_name: "Customer",
  phone: "9876543210",
}

export const TEST_ADMIN = {
  email: "admin@suprameds.in",
  password: "supersecret123",
}

export const TEST_ADDRESS = {
  first_name: "Test",
  last_name: "Customer",
  address_1: "123 Test Street",
  city: "Mumbai",
  province: "Maharashtra",
  postal_code: "400001",
  country_code: "in",
  phone: "9876543210",
}

export const BACKEND_URL = "http://localhost:9000"
export const STOREFRONT_URL = "http://localhost:5173"
export const COUNTRY_CODE = "in"

/** A known OTC product handle (no Rx required) */
export const OTC_PRODUCT_HANDLE = "supracyn-dapacyn-5-tab"

/** A known Rx (Schedule H) product handle — used in prescription flow tests */
export const RX_PRODUCT_HANDLE = "supracyn-dapacyn-5-tab"

/** Publishable API key for direct store API calls */
export const PK = "pk_98c62c9c8422c640ebfe80804e087eaa8e90ae8b954979a25475247eed8b7c9d"
