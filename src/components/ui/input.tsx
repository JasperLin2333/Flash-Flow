import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-gray-900 placeholder:text-gray-400 selection:bg-black selection:text-white dark:bg-gray-900/30 border-gray-200 h-9 w-full min-w-0 rounded-lg border bg-white px-3 py-1 text-base shadow-sm transition-all duration-150 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-black focus-visible:ring-2 focus-visible:ring-black/10",
        "aria-invalid:ring-red-600/20 dark:aria-invalid:ring-red-600/40 aria-invalid:border-red-600",
        className
      )}
      {...props}
    />
  )
}

export { Input }
