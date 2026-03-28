import { clsx } from "clsx"

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = ({ className, ...props }: InputProps) => {
  return (
    <input
      className={clsx(
        "appearance-none shadow-none outline-none focus:outline-none",
        "border border-[var(--border-primary)]",
        "rounded-none",
        "text-base font-medium text-[var(--text-primary)]",
        "px-4 py-2 w-full",
        "bg-[var(--bg-secondary)]",
        "placeholder:text-[var(--text-secondary)]",
        className
      )}
      {...props}
    />
  )
}
