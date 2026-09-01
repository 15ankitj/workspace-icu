"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { cn } from "@/lib/utils";

const CALLOUT_COLOURS = ["gray", "blue", "green", "yellow", "red"] as const;

const colourClasses: Record<(typeof CALLOUT_COLOURS)[number], string> = {
  gray: "bg-muted",
  blue: "bg-blue-500/10",
  green: "bg-green-500/10",
  yellow: "bg-yellow-500/10",
  red: "bg-red-500/10",
};

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
      const colour = block.props.colour as (typeof CALLOUT_COLOURS)[number];
      const cycleColour = () => {
        const next =
          CALLOUT_COLOURS[
            (CALLOUT_COLOURS.indexOf(colour) + 1) % CALLOUT_COLOURS.length
          ];
        editor.updateBlock(block, { props: { colour: next } });
      };
      return (
        <div
          className={cn(
            "flex w-full items-start gap-2 rounded-md p-3",
            colourClasses[colour] ?? colourClasses.gray,
          )}
        >
          <button
            type="button"
            contentEditable={false}
            className="shrink-0 select-none rounded p-0.5 text-lg leading-none hover:bg-background/60"
            title="Change colour"
            aria-label="Change callout colour"
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
