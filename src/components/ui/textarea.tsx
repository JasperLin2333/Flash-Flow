import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-gray-200 placeholder:text-gray-400 focus-visible:border-black focus-visible:ring-black/10 aria-invalid:ring-red-600/20 dark:aria-invalid:ring-red-600/40 aria-invalid:border-red-600 dark:bg-gray-900/30 flex field-sizing-content min-h-16 w-full rounded-lg border bg-white px-3 py-2 text-base shadow-sm transition-all duration-150 outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
