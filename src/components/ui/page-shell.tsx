import * as React from "react";
import { cn } from "@/lib/utils";

const widths = {
  /** Forms and short flows: sign-in, invitations. */
  narrow: "max-w-sm",
  /** Settings, lists, static text. */
  reading: "max-w-2xl",
  /** Page content and card grids. */
  wide: "max-w-3xl",
  full: "",
} as const;

/**
 * The page container every route uses: one gutter, one set of widths, and
 * the `#main` target the skip link jumps to.
 */
function PageShell({
  width = "reading",
  className,
  children,
  ...props
}: React.ComponentProps<"main"> & { width?: keyof typeof widths }) {
  return (
    <main
      id="main"
      className={cn(
        "mx-auto flex w-full flex-col gap-8 p-6 md:p-12",
        widths[width],
        className,
      )}
      {...props}
    >
      {children}
    </main>
  );
}

/** Page title plus a one-line description. */
function PageHeading({
  title,
  children,
  actions,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children && (
          <p className="text-sm text-muted-foreground">{children}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

/** Section heading at the same weight as the body it introduces. */
function SectionHeading({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "flex items-center gap-2 text-base font-semibold",
        className,
      )}
      {...props}
    />
  );
}

export { PageShell, PageHeading, SectionHeading };
