import { cn } from "@/lib/utils";
import { WEAVE_DARK_STRANDS, WEAVE_LIGHT_STRANDS, WORDMARK } from "./geometry";

/*
 * WorkspaceICU brand marks (docs/brand.md). Inline SVG so they follow the
 * light/dark theme (the `.dark` class) without extra requests. Static
 * exports for email and other apps live in /public/brand.
 */

const strandA = "fill-[#0E76D3] dark:fill-[#2186E0]";
const strandB = "fill-[#0064B7] dark:fill-[#0F6FC4]";

/** The cross-weave symbol, without its tile. Decorative unless `label` is set. */
export function BrandMark({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="7 7 26 26"
      className={cn("size-6 shrink-0", className)}
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true, focusable: false })}
    >
      <path className={strandA} d={WEAVE_LIGHT_STRANDS} />
      <path className={strandB} d={WEAVE_DARK_STRANDS} />
    </svg>
  );
}

/** Symbol + "WorkspaceICU" lettering. Announced as "WorkspaceICU". */
export function Wordmark({ className }: { className?: string }) {
  const k = WORDMARK.height / 26;
  return (
    <svg
      viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
      className={cn("h-8 w-auto", className)}
      role="img"
      aria-label="WorkspaceICU"
    >
      <g transform={`translate(${-7 * k} ${-7 * k}) scale(${k})`}>
        <path className={strandA} d={WEAVE_LIGHT_STRANDS} />
        <path className={strandB} d={WEAVE_DARK_STRANDS} />
      </g>
      <path
        className="fill-[#0F1E30] dark:fill-[#F3F7FB]"
        transform={`translate(${WORDMARK.workspace.x} ${WORDMARK.workspace.y})`}
        d={WORDMARK.workspace.d}
      />
      <path
        className="fill-[#0B6CC9] dark:fill-[#3D96EA]"
        transform={`translate(${WORDMARK.icu.x} ${WORDMARK.icu.y})`}
        d={WORDMARK.icu.d}
      />
    </svg>
  );
}
