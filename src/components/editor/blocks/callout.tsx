"use client";

import { createReactBlockSpec } from "@blocknote/react";
import {
  CALLOUT_COLOURS,
  CALLOUT_LABELS,
  calloutClass,
  type CalloutColour,
} from "@/lib/callout";
import { cn } from "@/lib/utils";

/** Callout: icon + colour + rich-text content (brief §6). */
export const createCalloutSpec = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      emoji: { default: "💡" },
      colour: { default: "gray", values: [...CALLOUT_COLOURS] },
    },
    content: "inline",
  },
  {
    render: ({ block, editor, contentRef }) => {
      const colour = block.props.colour as CalloutColour;
      const next =
        CALLOUT_COLOURS[
          (CALLOUT_COLOURS.indexOf(colour) + 1) % CALLOUT_COLOURS.length
        ];
      const cycleColour = () =>
        editor.updateBlock(block, { props: { colour: next } });
      return (
        <div
          className={cn(
            "flex w-full items-start gap-2 rounded-md border-l-4 p-3",
            calloutClass(colour),
          )}
        >
          <button
            type="button"
            contentEditable={false}
            className="shrink-0 select-none rounded p-0.5 text-lg leading-none hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={`Colour: ${CALLOUT_LABELS[colour] ?? "Grey"}. Click for ${CALLOUT_LABELS[next]}`}
            aria-label={`Callout colour ${CALLOUT_LABELS[colour] ?? "Grey"}; change to ${CALLOUT_LABELS[next]}`}
            onClick={cycleColour}
          >
            {block.props.emoji}
          </button>
          <div ref={contentRef} className="min-w-0 flex-1" />
        </div>
      );
    },
  },
);
