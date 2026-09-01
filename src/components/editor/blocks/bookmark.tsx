"use client";

import { useState, useTransition } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { Globe } from "lucide-react";
import { fetchBookmarkMetadata } from "@/app/actions/bookmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function BookmarkInput({
  onSubmit,
  busy,
}: {
  onSubmit: (url: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const submit = () => {
    try {
      new URL(value.trim());
      onSubmit(value.trim());
    } catch {
      setInvalid(true);
    }
  };
  return (
    <div
      contentEditable={false}
      className="rounded-md border border-dashed p-3"
    >
      <div className="flex gap-2">
        <Input
          value={value}
          placeholder="Paste a link to bookmark…"
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "Fetching…" : "Add"}
        </Button>
      </div>
      {invalid && (
        <p className="mt-2 text-xs text-destructive">
          That doesn&apos;t look like a URL.
        </p>
      )}
    </div>
  );
}

/** Link/bookmark card: URL with fetched title/description where available. */
export const createBookmarkSpec = createReactBlockSpec(
  {
    type: "bookmark",
    propSchema: {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const { url, title, description } = block.props as {
        url: string;
        title: string;
        description: string;
      };
      // eslint-disable-next-line react-hooks/rules-of-hooks -- render is a component
      const [isPending, startTransition] = useTransition();

      if (!url) {
        return (
          <BookmarkInput
            busy={isPending}
            onSubmit={(next) =>
              startTransition(async () => {
                const meta = await fetchBookmarkMetadata(next).catch(
                  () => null,
                );
                editor.updateBlock(block, {
                  props: {
                    url: next,
                    title: meta?.title ?? "",
                    description: meta?.description ?? "",
                  },
                });
              })
            }
          />
        );
      }

      let host = url;
      try {
        host = new URL(url).hostname;
      } catch {
        // keep raw url as the label
      }

      return (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          contentEditable={false}
          className="flex w-full flex-col gap-0.5 rounded-md border p-3 no-underline hover:bg-accent"
        >
          <span className="truncate text-sm font-medium text-foreground">
            {title || url}
          </span>
          {description && (
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {description}
            </span>
          )}
          <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Globe className="size-3" /> {host}
          </span>
        </a>
      );
    },
  },
);
