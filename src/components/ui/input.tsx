import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared form-control styling so inputs, textareas and selects match. */
export const controlClassName =
  "w-full rounded-md border border-input bg-transparent text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(controlClassName, "flex h-9 px-3 py-1", className)}
      {...props}
    />
  );
}

export { Input };
