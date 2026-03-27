import { type Page, expect } from "@playwright/test"
import { TEST_ADDRESS } from "../fixtures/test-data"

type AddressFields = typeof TEST_ADDRESS

/**
 * Page-object model for the checkout flow.
 * Each method waits for the relevant UI to be ready before interacting.
 */
export class CheckoutPage {
  constructor(private page: Page) {}

  /** Navigate to the address step (first step) of checkout. */
  async goto() {
    await this.page.goto("/in/checkout?step=addresses")
    await this.page.waitForLoadState("networkidle")
  }

  /**
   * Fill the shipping address form.
   * Tries data-testid selectors first, falls back to name/label selectors.
   */
  async fillAddress(address: AddressFields = TEST_ADDRESS) {
    const p = this.page

    const fill = async (selector: string, value: string) => {
      const el = p.locator(selector).first()
      await el.waitFor({ state: "visible", timeout: 10_000 })
      await el.fill(value)
    }

    await fill('[name="first_name"], [data-testid="first-name-input"]', address.first_name)
    await fill('[name="last_name"], [data-testid="last-name-input"]', address.last_name)
    await fill('[name="address_1"], [data-testid="address-1-input"]', address.address_1)
    await fill('[name="city"], [data-testid="city-input"]', address.city)
    await fill('[name="province"], [data-testid="province-input"]', address.province)
    await fill('[name="postal_code"], [data-testid="postal-code-input"]', address.postal_code)
    await fill('[name="phone"], [data-testid="phone-input"]', address.phone)
  }

  /** Select the first available shipping method in the delivery step. */
  async selectFirstShippingMethod() {
    const p = this.page
    // Shipping options are typically rendered as radio buttons or clickable cards
    const firstOption = p
      .locator('[data-testid="delivery-option"], input[type="radio"]')
      .first()
    await firstOption.waitFor({ state: "visible", timeout: 10_000 })
    await firstOption.click()
  }

  /** Click the primary continue/next button in the current checkout step. */
  async continueToNextStep() {
    const p = this.page
    const continueBtn = p
      .locator(
        '[data-testid="submit-address-button"], [data-testid="submit-delivery-button"], button:has-text("Continue"), button:has-text("Next")'
      )
      .first()
    await continueBtn.waitFor({ state: "visible", timeout: 10_000 })
    await continueBtn.click()
  }

  /** Assert the prescription step heading / warning is visible. */
  async expectPrescriptionStepVisible() {
    await expect(
      this.page.getByText("Your cart contains prescription medicines").first()
    ).toBeVisible({ timeout: 15_000 })
  }

  /** Assert the "Continue to Payment" button is disabled (no Rx attached). */
  async expectProceedBlockedWithoutRx() {
    const continueBtn = this.page.getByRole("button", {
      name: /Continue to Payment/,
    })
    await expect(continueBtn).toBeDisabled({ timeout: 10_000 })
  }
}
