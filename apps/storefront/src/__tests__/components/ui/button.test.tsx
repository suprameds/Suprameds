import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { Button } from "@/components/ui/button"

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument()
  })

  it("shows spinner when loading=true", () => {
    render(<Button loading>Submit</Button>)
    const svg = document.querySelector("svg.animate-spin")
    expect(svg).toBeInTheDocument()
  })

  it("does not show spinner when loading=false", () => {
    render(<Button>Submit</Button>)
    const svg = document.querySelector("svg.animate-spin")
    expect(svg).not.toBeInTheDocument()
  })

  it("is disabled when loading=true", () => {
    render(<Button loading>Submit</Button>)
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("is disabled when disabled=true", () => {
    render(<Button disabled>Submit</Button>)
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("is disabled when both loading and disabled", () => {
    render(<Button loading disabled>Submit</Button>)
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("is not disabled when neither loading nor disabled", () => {
    render(<Button>Submit</Button>)
    expect(screen.getByRole("button")).not.toBeDisabled()
  })

  it("still renders children alongside spinner when loading", () => {
    render(<Button loading>Processing…</Button>)
    expect(screen.getByText("Processing…")).toBeInTheDocument()
    expect(document.querySelector("svg.animate-spin")).toBeInTheDocument()
  })

  it("calls onClick when not disabled/loading", async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("does not call onClick when loading", async () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole("button"))
    expect(onClick).not.toHaveBeenCalled()
  })

  it("applies primary variant styles by default", () => {
    render(<Button>Primary</Button>)
    expect(screen.getByRole("button")).toHaveClass("bg-[#0E7C86]")
  })

  it("applies secondary variant styles", () => {
    render(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole("button")).toHaveClass("bg-white")
  })

  it("applies danger variant styles", () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByRole("button")).toHaveClass("bg-rose-500")
  })

  it("applies size=fit class", () => {
    render(<Button size="fit">Small</Button>)
    expect(screen.getByRole("button")).toHaveClass("w-fit")
  })

  it("applies size=full class by default", () => {
    render(<Button>Wide</Button>)
    expect(screen.getByRole("button")).toHaveClass("w-full")
  })
})
