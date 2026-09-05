"use client";

import { useId, useState, useTransition } from "react";
import { Check, Image as ImageIcon } from "lucide-react";
import { setPageCover } from "@/app/actions/pages";
import { COVER_GRADIENTS, coverGradient, isValidCover } from "@/lib/cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function CoverPicker({
  pageId,
  current,
  trigger,
}: {
  pageId: string;
  current: string | null;
  trigger: React.ReactNode;
}) {
  const [, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [invalid, setInvalid] = useState(false);
  const urlId = useId();

  const setUrlCover = () => {
    if (isValidCover(url.trim()))
      startTransition(() => setPageCover(pageId, url.trim()));
    else setInvalid(true);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-2">
        <DropdownMenuLabel>Gradients</DropdownMenuLabel>
        <div className="grid grid-cols-4 gap-1 px-1 pb-1">
          {COVER_GRADIENTS.map((gradient, index) => {
            const value = `gradient:${index}`;
            const selected = current === value;
            return (
              <button
                key={gradient}
                type="button"
                aria-label={`Gradient ${index + 1}${selected ? " (current)" : ""}`}
                aria-pressed={selected}
                className={cn(
                  "flex h-8 items-center justify-center rounded-md border hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected && "ring-2 ring-foreground",
                )}
                style={{ background: gradient }}
                onClick={() =>
                  startTransition(() => setPageCover(pageId, value))
                }
              >
                {selected && (
                  <Check
                    className="size-4 text-white drop-shadow"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
        <DropdownMenuSeparator />
        <Label
          htmlFor={urlId}
          className="px-2 py-1.5 text-xs text-muted-foreground"
        >
          Image URL
        </Label>
        <div className="flex gap-1 px-1 pb-1">
          <Input
            id={urlId}
            value={url}
            placeholder="https://…"
            className="h-8 text-xs"
            aria-invalid={invalid || undefined}
            onChange={(e) => {
              setUrl(e.target.value);
              setInvalid(false);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              setUrlCover();
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={setUrlCover}
          >
            Set
          </Button>
        </div>
        {invalid && (
          <p role="alert" className="px-1 pb-1 text-xs text-destructive">
            Needs to be an https image URL.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The quiet "Add cover" trigger, placed in the page header's hover row. */
export function AddCoverButton({ pageId }: { pageId: string }) {
  return (
    <CoverPicker
      pageId={pageId}
      current={null}
      trigger={
        <Button variant="ghost" size="xs" className="text-muted-foreground">
          <ImageIcon /> Add cover
        </Button>
      }
    />
  );
}

/** Page cover banner: preset gradient or https image, per brief §5. */
export function PageCover({
  pageId,
  cover,
  canEdit,
}: {
  pageId: string;
  cover: string;
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const gradient = coverGradient(cover);

  return (
    <div className="group relative h-40 w-full overflow-hidden rounded-md md:h-52">
      {gradient ? (
        <div className="h-full w-full" style={{ background: gradient }} />
      ) : (
        // Arbitrary remote hosts; next/image needs a domain allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      )}
      {canEdit && (
        // Shown on hover, on keyboard focus, and always on touch screens;
        // a backdrop keeps the buttons legible over any image.
        <div className="absolute bottom-2 right-2 flex gap-1 rounded-md bg-background/85 p-1 opacity-0 shadow-sm backdrop-blur transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <CoverPicker
            pageId={pageId}
            current={cover}
            trigger={
              <Button variant="ghost" size="sm">
                Change cover
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => setPageCover(pageId, null))}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
