import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-md border-2 border-ink bg-cream px-4 py-2 text-base font-body",
        "placeholder:text-ink-soft/60 transition-colors outline-none",
        "focus-visible:border-indigo focus-visible:ring-4 focus-visible:ring-indigo/20",
        "disabled:pointer-events-none disabled:opacity-60",
        "aria-invalid:border-error aria-invalid:ring-4 aria-invalid:ring-error/20",
        "file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  );
}

export { Input };
