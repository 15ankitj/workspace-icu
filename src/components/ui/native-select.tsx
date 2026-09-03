import * as React from "react";
import { ChevronDown } from "lucide-react";
import { controlClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A styled native `<select>`: the same height, border and focus ring as
 * Input, with a consistent chevron. Native so it works in server-rendered
 * forms without client JavaScript.
 */
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select
        className={cn(controlClassName, "h-9 appearance-none pl-3 pr-8")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}

export { NativeSelect };
