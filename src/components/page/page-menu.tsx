"use client";

import { useTransition } from "react";
import { Check, MoreHorizontal } from "lucide-react";
import { setPageLayout } from "@/app/actions/pages";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function Tick({ on }: { on: boolean }) {
  return <Check className={cn("size-4", !on && "invisible")} />;
}

/** Page layout options: full width and small text (brief §5). */
export function PageMenu({
  pageId,
  fullWidth,
  smallText,
}: {
  pageId: string;
  fullWidth: boolean;
  smallText: boolean;
}) {
  const [, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Page options">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Layout</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() =>
            startTransition(() =>
              setPageLayout(pageId, { fullWidth: !fullWidth }),
            )
          }
        >
          <Tick on={fullWidth} /> Full width
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            startTransition(() =>
              setPageLayout(pageId, { smallText: !smallText }),
            )
          }
        >
          <Tick on={smallText} /> Small text
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
