import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react"

interface OtpDigitInputProps {
  value: string
  onChange: (v: string) => void
  length?: number
}

export const OtpDigitInput = forwardRef<HTMLInputElement, OtpDigitInputProps>(
  ({ value, onChange, length = 6 }, ref) => {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Expose focus on the first empty cell
    useImperativeHandle(ref, () => {
      const idx = value.length < length ? value.length : length - 1
      return inputRefs.current[idx] || (inputRefs.current[0] as HTMLInputElement)
    })

    useEffect(() => {
      // Auto-focus the next empty cell when value changes externally
      const idx = value.length < length ? value.length : length - 1
      inputRefs.current[idx]?.focus()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

    const digits = value.split("").slice(0, length)
    while (digits.length < length) digits.push("")

    const focusCell = useCallback(
      (i: number) => {
        const clamped = Math.max(0, Math.min(i, length - 1))
        inputRefs.current[clamped]?.focus()
      },
      [length]
    )

    const handleChange = useCallback(
      (i: number, raw: string) => {
        // Strip non-digits up front so SMS-autofill payloads like "123 456" or
        // "Your code: 123456" still work when iOS/Android type them into a cell.
        const digits = raw.replace(/\D/g, "")
        if (!digits) return

        // Autofill / paste path: iOS Safari + Android Gboard "tap to fill from
        // SMS" types the entire code into the focused cell at once. Distribute
        // those digits across the remaining cells instead of keeping just one.
        if (digits.length > 1) {
          const arr = value.split("").slice(0, length)
          while (arr.length < length) arr.push("")
          for (let k = 0; k < digits.length && i + k < length; k++) {
            arr[i + k] = digits[k]
          }
          const next = arr.join("").replace(/[^\d]/g, "")
          onChange(next)
          // Focus the next empty cell, or blur the last one so the keyboard
          // dismisses and the verify button is reachable.
          const filledTo = Math.min(i + digits.length, length)
          if (filledTo >= length) {
            inputRefs.current[length - 1]?.blur()
          } else {
            focusCell(filledTo)
          }
          return
        }

        // Single-digit path: standard typing.
        const arr = value.split("").slice(0, length)
        while (arr.length < length) arr.push("")
        arr[i] = digits
        const next = arr.join("").replace(/[^\d]/g, "")
        onChange(next)
        if (i < length - 1) focusCell(i + 1)
      },
      [value, onChange, length, focusCell]
    )

    const handleKeyDown = useCallback(
      (i: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace") {
          e.preventDefault()
          const arr = value.split("").slice(0, length)
          while (arr.length < length) arr.push("")
          if (arr[i]) {
            arr[i] = ""
            onChange(arr.join("").replace(/\s/g, ""))
          } else if (i > 0) {
            arr[i - 1] = ""
            onChange(arr.join("").replace(/\s/g, ""))
            focusCell(i - 1)
          }
        } else if (e.key === "ArrowLeft" && i > 0) {
          focusCell(i - 1)
        } else if (e.key === "ArrowRight" && i < length - 1) {
          focusCell(i + 1)
        }
      },
      [value, onChange, length, focusCell]
    )

    const handlePaste = useCallback(
      (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pasted = e.clipboardData
          .getData("text")
          .replace(/\D/g, "")
          .slice(0, length)
        if (pasted) onChange(pasted)
      },
      [onChange, length]
    )

    return (
      <fieldset className="border-none p-0 m-0">
        <legend className="sr-only">Enter OTP</legend>
        <div className="flex gap-2 justify-between" onPaste={handlePaste}>
          {digits.map((d, i) => {
            const isFilled = d !== ""
            const isActive = i === value.length && value.length < length

            return (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                // No maxLength: SMS autofill types the whole code into the
                // focused cell at once, and handleChange splits it across cells.
                // Capping at 1 here would discard 5 of 6 digits.
                value={d}
                aria-label={`Digit ${i + 1} of ${length}`}
                // Mark every cell as one-time-code so whichever cell the user
                // taps gets the SMS-autofill suggestion (iOS focuses cell 0,
                // but some Android keyboards only attach to the focused cell).
                autoComplete="one-time-code"
                name={i === 0 ? "otp" : `otp-${i}`}
                className="flex-1 h-14 text-center text-2xl font-normal rounded-xl border-[1.5px] outline-none transition-all duration-200"
                style={{
                  fontFamily: "var(--font-serif)",
                  borderColor: isFilled
                    ? "var(--color-brand-navy)"
                    : isActive
                      ? "var(--color-brand-teal)"
                      : "var(--color-brand-cream-dark)",
                  background: isFilled ? "var(--color-brand-cream)" : "white",
                  color: "var(--color-brand-navy)",
                  boxShadow: isActive ? "0 0 0 4px rgba(14,124,134,.12)" : "none",
                }}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={() => {
                  // Jump to the first empty cell if clicking a later cell
                  if (i > value.length) focusCell(value.length)
                }}
              />
            )
          })}
        </div>
      </fieldset>
    )
  }
)
OtpDigitInput.displayName = "OtpDigitInput"
