import { render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach } from "vitest"
import { ConsentBanner } from "@/components/consent-banner"

describe("ConsentBanner – Accessibility", () => {
  beforeEach(() => {
    localStorage.removeItem("suprameds_dpdp_consent")
  })

  it("renders with role=dialog and aria-label when consent not given", async () => {
    render(<ConsentBanner />)

    await waitFor(() => {
      const banner = screen.getByRole("dialog", { name: "Cookie consent" })
      expect(banner).toBeInTheDocument()
    })
  })

  it("shows Accept button", async () => {
    render(<ConsentBanner />)

    await waitFor(() => {
      expect(screen.getByText("Accept")).toBeInTheDocument()
    })
  })

  it("does not render when consent was previously given", () => {
    localStorage.setItem(
      "suprameds_dpdp_consent",
      JSON.stringify({ accepted: true, timestamp: new Date().toISOString(), version: "1.0" })
    )

    render(<ConsentBanner />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
