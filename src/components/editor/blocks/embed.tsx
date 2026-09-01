"use client";

import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { resolveEmbedUrl } from "@/lib/embed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function EmbedInput({ onSubmit }: { onSubmit: (url: string) => void }) {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const submit = () => {
    if (resolveEmbedUrl(value)) onSubmit(value.trim());
    else setInvalid(true);
  };
  return (
    <div
      contentEditable={false}
      className="rounded-md border border-dashed p-3"
    >
      <div className="flex gap-2">
        <Input
          value={value}
          placeholder="Paste a YouTube, Google Drive or PDF link…"
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button type="button" variant="secondary" onClick={submit}>
          Embed
        </Button>
      </div>
      {invalid && (
        <p className="mt-2 text-xs text-destructive">
          Only YouTube, Google Drive and PDF links can be embedded.
        </p>
      )}
    </div>
  );
}

/** Whitelisted iframe embeds only (brief §6): YouTube, Drive viewer, PDF. */
export const createEmbedSpec = createReactBlockSpec(
  {
    type: "embed",
    propSchema: { url: { default: "" } },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const url = block.props.url as string;
      const resolved = url ? resolveEmbedUrl(url) : null;

      if (!resolved) {
        return (
          <EmbedInput
            onSubmit={(next) =>
              editor.updateBlock(block, { props: { url: next } })
            }
          />
        );
      }

      return (
        <div contentEditable={false} className="w-full">
          <iframe
            src={resolved.src}
            className={cn(
              "w-full rounded-md border",
              resolved.kind === "youtube" ? "aspect-video" : "h-[480px]",
            )}
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            referrerPolicy="no-referrer"
            allowFullScreen
            title="Embedded content"
          />
        </div>
      );
    },
  },
);
