"use client";

import { useTransition } from "react";
import { Lock } from "lucide-react";
import { setPagePrivacy } from "@/app/actions/pages";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";

/**
 * "Make private" / "Make shared" for a page's creator, in the page ⋯ menu
 * and in the sidebar row's menu alike, so the label, icon and action
 * cannot drift between the two. Callers render it only for the creator:
 * a private page is the creator's alone (concept brief), never an
 * editor's or an owner's to toggle.
 */
export function PrivacyMenuItem({
  pageId,
  isPrivate,
}: {
  pageId: string;
  isPrivate: boolean;
}) {
  const [, startTransition] = useTransition();
  return (
    <DropdownMenuItem
      onSelect={() =>
        startTransition(async () => {
          try {
            await setPagePrivacy(pageId, !isPrivate);
          } catch (error) {
            toast({
              variant: "destructive",
              title: isPrivate
                ? "Couldn't make the page shared"
                : "Couldn't make the page private",
              description:
                error instanceof Error ? error.message : "Please try again.",
            });
          }
        })
      }
    >
      <Lock />
      {isPrivate ? "Make shared" : "Make private"}
    </DropdownMenuItem>
  );
}
