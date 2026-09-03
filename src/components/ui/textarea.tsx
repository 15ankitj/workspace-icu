import * as React from "react";
import { controlClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlClassName, "min-h-16 px-3 py-2", className)}
      {...props}
    />
  );
}

export { Textarea };
