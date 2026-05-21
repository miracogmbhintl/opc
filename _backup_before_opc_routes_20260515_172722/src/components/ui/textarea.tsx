import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Miraka & Co. Unified Form Textarea Styling
        "flex w-full",
        "min-h-[120px] p-[14px]",
        "rounded-[16px]",
        "border border-[#E6E6E6] bg-[#FFFFFF]",
        "text-[15px] font-medium text-[#2A2A2A] leading-relaxed",
        "placeholder:text-[#9A9A9A] placeholder:font-semibold",
        "transition-all duration-200",
        "outline-none shadow-none",
        "resize-vertical",
        "hover:border-[#2A2A2A]",
        "focus:border-[#1A1A1A] focus:bg-[#FAFAFA] focus:shadow-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Selection styling
        "selection:bg-[#1A1A1A] selection:text-[#FFFFFF]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

