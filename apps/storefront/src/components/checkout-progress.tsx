import { Button } from "@/components/ui/button"
import { CheckoutStep, CheckoutStepKey } from "@/lib/types/global"
import { clsx } from "clsx"

type CheckoutProgressProps = {
  steps: CheckoutStep[];
  currentStepIndex: number;
  handleStepChange: (step: CheckoutStepKey) => void;
  className?: string;
};

const CheckoutProgress = ({
  steps,
  currentStepIndex,
  handleStepChange,
  className,
}: CheckoutProgressProps) => {
  return (
    <div className={clsx("overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0", className)}>
      <div className="flex gap-2 sm:gap-4 items-center min-w-max sm:min-w-0 sm:flex-wrap">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center gap-2 sm:gap-4">
            <Button
              onClick={() => handleStepChange(step.key)}
              variant={"transparent"}
              className={clsx(
                "p-0 hover:bg-transparent text-xs sm:text-sm whitespace-nowrap",
                index !== currentStepIndex &&
                  "text-zinc-600 hover:text-zinc-500",
                index === currentStepIndex &&
                  "text-zinc-900 hover:text-zinc-600 font-semibold"
              )}
              disabled={index > currentStepIndex}
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={clsx(
                    "w-5 h-5 rounded-full text-[10px] font-bold inline-flex items-center justify-center flex-shrink-0",
                    index < currentStepIndex && "bg-[#27AE60] text-white",
                    index === currentStepIndex && "bg-[#0D1B2A] text-white",
                    index > currentStepIndex && "bg-zinc-200 text-zinc-500"
                  )}
                >
                  {index < currentStepIndex ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    index + 1
                  )}
                </span>
                {step.title}
              </span>
            </Button>
            {index < steps.length - 1 && (
              <div className="w-6 sm:w-8 h-px bg-zinc-200 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default CheckoutProgress
