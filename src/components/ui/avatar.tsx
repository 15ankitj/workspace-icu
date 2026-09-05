import * as React from "react";
import { cn } from "@/lib/utils";

const COLOURS = [
  "bg-rose-600",
  "bg-amber-600",
  "bg-green-700",
  "bg-cyan-700",
  "bg-blue-600",
  "bg-violet-600",
  "bg-pink-600",
  "bg-teal-700",
];

/** Stable colour per id so a person looks the same everywhere. */
export function avatarColour(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return COLOURS[Math.abs(hash) % COLOURS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const sizes = {
  xs: "size-[18px] text-[8px]",
  sm: "size-5 text-[9px]",
  md: "size-6 text-[10px]",
} as const;

/** Initials avatar; `avatar_url` is never populated today, so initials it is. */
export function Avatar({
  id,
  name,
  size = "sm",
  className,
  ...props
}: React.ComponentProps<"span"> & {
  id: string;
  name: string;
  size?: keyof typeof sizes;
}) {
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        sizes[size],
        avatarColour(id),
        className,
      )}
      {...props}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping avatars, capped, with a "+N" tail. */
export function AvatarStack({
  people,
  max = 3,
  size = "sm",
}: {
  people: { id: string; name: string }[];
  max?: number;
  size?: keyof typeof sizes;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <Avatar
          key={p.id}
          id={p.id}
          name={p.name}
          size={size}
          className={cn("ring-2 ring-background", i > 0 && "-ml-1.5")}
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "-ml-1.5 inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background",
            sizes[size],
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
