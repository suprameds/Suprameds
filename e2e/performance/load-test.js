/**
 * k6 Load Test — run with: k6 run e2e/performance/load-test.js
 * Requires k6 installed: https://k6.io/docs/getting-started/installation/
 */
import http from "k6/http"
import { check, sleep } from "k6"
import { Rate, Trend } from "k6/metrics"

const errorRate = new Rate("errors")
const productListDuration = new Trend("product_list_duration")
const cartCreateDuration = new Trend("cart_create_duration")

const API_URL = __ENV.API_URL || "http://localhost:9000"

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "1m", target: 100 },
    { duration: "30s", target: 0 },
  ],

  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1500"],
    errors: ["rate<0.01"],
    product_list_duration: ["p(95)<400"],
    cart_create_duration: ["p(95)<600"],
  },
}

export default function () {
  // Browse products
  const productRes = http.get(`${API_URL}/store/products?limit=12`)
  productListDuration.add(productRes.timings.duration)

  check(productRes, {
    "products: status 200": (r) => r.status === 200,
    "products: has data": (r) => {
      const body = JSON.parse(r.body)
      return body.products && body.products.length > 0
    },
    "products: response < 500ms": (r) => r.timings.duration < 500,
  }) || errorRate.add(1)

  sleep(1)

  // View single product
  const listBody = JSON.parse(productRes.body)
  if (listBody.products && listBody.products.length > 0) {
    const productId = listBody.products[0].id
    const detailRes = http.get(`${API_URL}/store/products/${productId}`)

    check(detailRes, {
      "product detail: status 200": (r) => r.status === 200,
      "product detail: response < 400ms": (r) => r.timings.duration < 400,
    }) || errorRate.add(1)
  }

  sleep(0.5)

  // Create cart
  const cartRes = http.post(
    `${API_URL}/store/carts`,
    JSON.stringify({}),
    { headers: { "Content-Type": "application/json" } }
  )
  cartCreateDuration.add(cartRes.timings.duration)

  check(cartRes, {
    "cart: status 200": (r) => r.status === 200,
    "cart: has id": (r) => {
      const body = JSON.parse(r.body)
      return body.cart && body.cart.id
    },
    "cart: response < 600ms": (r) => r.timings.duration < 600,
  }) || errorRate.add(1)

  sleep(1)

  // Search
  const searchRes = http.get(`${API_URL}/store/products?q=paracetamol&limit=10`)

  check(searchRes, {
    "search: status 200": (r) => r.status === 200,
    "search: response < 600ms": (r) => r.timings.duration < 600,
  }) || errorRate.add(1)

  sleep(1)

  // Health check
  const healthRes = http.get(`${API_URL}/health`)

  check(healthRes, {
    "health: status 200": (r) => r.status === 200,
    "health: response < 100ms": (r) => r.timings.duration < 100,
  }) || errorRate.add(1)

  sleep(0.5)
}
