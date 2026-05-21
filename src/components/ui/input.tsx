import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Miraka & Co. Unified Form Input Styling
        "flex w-full min-w-0",
        "h-[48px] px-[14px]",
        "rounded-[16px]",
        "border border-[#E6E6E6] bg-[#FFFFFF]",
        "text-[15px] font-medium text-[#2A2A2A]",
        "placeholder:text-[#9A9A9A] placeholder:font-semibold",
        "transition-all duration-200",
        "outline-none shadow-none",
        "hover:border-[#2A2A2A]",
        "focus:border-[#1A1A1A] focus:bg-[#FAFAFA] focus:shadow-none",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // File input specific styles
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#2A2A2A]",
        // Selection styling
        "selection:bg-[#1A1A1A] selection:text-[#FFFFFF]",
        className
      )}
      {...props}
    />
  )
}

export { Input }

