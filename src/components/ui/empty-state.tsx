import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * One empty-state pattern: a dashed card, one sentence, one action where
 * there is something the user can do about it. `compact` is for panels and
 * lists inside the sidebar or a dialog.
 */
function EmptyState({
  className,
  title,
  children,
  action,
  compact = false,
  ...props
}: React.ComponentProps<"div"> & {
  title?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed text-sm text-muted-foreground",
        compact ? "px-3 py-2" : "flex flex-col items-start gap-3 p-6",
        className,
      )}
      {...props}
    >
      {title && <p className="font-medium text-foreground">{title}</p>}
      {children && <div>{children}</div>}
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export { EmptyState };
