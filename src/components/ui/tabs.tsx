"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A segmented control: one selected value out of a few. Arrow keys move
 * between options, as a radio group does.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5",
        className,
      )}
      onKeyDown={(event) => {
        const index = options.findIndex((o) => o.value === value);
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          onChange(options[(index + 1) % options.length].value);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          onChange(
            options[(index - 1 + options.length) % options.length].value,
          );
        }
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 rounded px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
