import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const noticeVariants = cva(
  "flex gap-3 rounded-md border border-l-4 bg-card p-3 text-sm text-foreground",
  {
    variants: {
      variant: {
        info: "border-l-foreground/60",
        warning: "border-l-amber-600 dark:border-l-amber-400",
        destructive: "border-l-destructive",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const icons = {
  info: Info,
  warning: AlertTriangle,
  destructive: ShieldAlert,
} as const;

/**
 * The one component for copy that must be read: acceptable-use statements,
 * "not a clinical record" disclaimers, template updates, scan results. Full
 * foreground text with a coloured left rule, never muted or washed out.
 */
function Notice({
  className,
  variant,
  title,
  icon,
  actions,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof noticeVariants> & {
    title?: React.ReactNode;
    /** Pass `false` to omit the icon. */
    icon?: React.ReactNode | false;
    actions?: React.ReactNode;
  }) {
  const Icon = icons[variant ?? "info"];
  return (
    <div
      role={variant === "destructive" ? "alert" : undefined}
      className={cn(noticeVariants({ variant }), className)}
      {...props}
    >
      {icon !== false && (
        <span
          aria-hidden
          className={cn(
            "mt-0.5 shrink-0",
            variant === "destructive" && "text-destructive",
            variant === "warning" && "text-amber-700 dark:text-amber-400",
            (variant ?? "info") === "info" && "text-muted-foreground",
          )}
        >
          {icon ?? <Icon className="size-4" />}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        {title && <p className="font-medium leading-snug">{title}</p>}
        <div className="space-y-2 leading-relaxed">{children}</div>
        {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
      </div>
    </div>
  );
}

export { Notice };
