import { clsx } from "clsx"

type ButtonProps = React.DetailedHTMLProps<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> & {
  variant?: "primary" | "secondary" | "danger" | "transparent";
  size?: "full" | "fit";
  loading?: boolean;
};

const Spinner = () => (
  <svg
    className="animate-spin h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

export const Button = ({
  variant = "primary",
  className,
  size = "full",
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) => {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        "cursor-pointer disabled:cursor-default",
        "inline-flex items-center justify-center gap-2 px-4 py-2",
        "rounded-md shadow-none appearance-none border transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "text-base font-medium",
        size === "full" && "w-full",
        size === "fit" && "w-fit",
        {
          "bg-[var(--brand-teal)] text-white hover:bg-[var(--brand-teal-dark)] active:bg-[var(--brand-teal-dark)] border-transparent":
            variant === "primary",
          "bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] active:bg-[var(--border-primary)] border-[var(--text-primary)]":
            variant === "secondary",
          "bg-rose-500 text-white hover:bg-rose-600 active:bg-rose-900 border-transparent":
            variant === "danger",
          "bg-transparent text-[var(--text-primary)] hover:bg-transparent active:bg-transparent border-transparent":
            variant === "transparent",
        },
        className
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}
