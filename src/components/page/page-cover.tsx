"use client";

import { useState, useTransition } from "react";
import { Image as ImageIcon } from "lucide-react";
import { setPageCover } from "@/app/actions/pages";
import { COVER_GRADIENTS, coverGradient, isValidCover } from "@/lib/cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function CoverPicker({
  pageId,
  trigger,
}: {
  pageId: string;
  trigger: React.ReactNode;
}) {
  const [, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [invalid, setInvalid] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <DropdownMenuLabel>Gradients</DropdownMenuLabel>
        <div className="grid grid-cols-4 gap-1 px-1 pb-1">
          {COVER_GRADIENTS.map((gradient, index) => (
            <button
              key={gradient}
              type="button"
              aria-label={`Gradient cover ${index + 1}`}
              className="h-8 rounded border hover:ring-2 hover:ring-ring"
              style={{ background: gradient }}
              onClick={() =>
                startTransition(() => setPageCover(pageId, `gradient:${index}`))
              }
            />
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Image URL</DropdownMenuLabel>
        <div className="flex gap-1 px-1 pb-1">
          <Input
            value={url}
            placeholder="https://…"
            className="h-8 text-xs"
            onChange={(e) => {
              setUrl(e.target.value);
              setInvalid(false);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              if (isValidCover(url.trim()))
                startTransition(() => setPageCover(pageId, url.trim()));
              else setInvalid(true);
            }}
          >
            Set
          </Button>
        </div>
        {invalid && (
          <p className="px-1 pb-1 text-xs text-destructive">
            Needs to be an https image URL.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Page cover banner: preset gradient or https image, per brief §5. */
export function PageCover({
  pageId,
  cover,
  canEdit,
}: {
  pageId: string;
  cover: string | null;
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();

  if (!cover) {
    if (!canEdit) return null;
    return (
      <div className="mb-2">
        <CoverPicker
          pageId={pageId}
          trigger={
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ImageIcon /> Add cover
            </Button>
          }
        />
      </div>
    );
  }

  const gradient = coverGradient(cover);

  return (
    <div className="group relative mb-6 h-40 w-full overflow-hidden rounded-lg md:h-52">
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
        <div className="absolute bottom-2 right-2 hidden gap-1 group-hover:flex">
          <CoverPicker
            pageId={pageId}
            trigger={
              <Button variant="secondary" size="sm">
                Change
              </Button>
            }
          />
          <Button
            variant="secondary"
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
