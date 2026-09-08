"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPageAuthorship } from "@/app/actions/suggestions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

/**
 * Authored content (Appendix A §2.2): when on, everyone but the author
 * and named co-authors opens the page in Suggest mode and the server
 * refuses their direct changes. Authors and workspace owners set it.
 */
export function AuthorshipDialog({
  open,
  onOpenChange,
  workspaceId,
  pageId,
  creatorId,
  authored,
  coAuthors,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  pageId: string;
  creatorId: string;
  authored: boolean;
  coAuthors: string[];
  members: { id: string; displayName: string }[];
}) {
  const router = useRouter();
  const [isAuthored, setIsAuthored] = useState(authored);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(coAuthors),
  );
  const [busy, setBusy] = useState(false);
  const creator = members.find((m) => m.id === creatorId);

  const save = async () => {
    setBusy(true);
    try {
      await setPageAuthorship(workspaceId, pageId, isAuthored, [...selected]);
      toast({
        title: isAuthored
          ? "Authored content is on"
          : "Authored content is off",
        description: isAuthored
          ? "Others now suggest changes for the author to accept."
          : "Everyone who can edit this page edits it directly.",
      });
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast({
        title: "Could not update authorship",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogTitle>Authorship</DialogTitle>
        <DialogDescription>
          For pages that must stay in the author&apos;s voice — reflections, gap
          statements, the application narrative.
        </DialogDescription>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4"
            checked={isAuthored}
            onChange={(e) => setIsAuthored(e.target.checked)}
          />
          <span>
            <span className="font-medium">Authored content</span>
            <span className="block text-muted-foreground">
              Others open this page in Suggest mode. Their insertions and
              deletions stay marked until the author accepts or rejects them;
              the server refuses direct changes from anyone else.
            </span>
          </span>
        </label>
        <div className="space-y-1 text-sm">
          <p className="font-medium">Authors</p>
          <p className="text-muted-foreground">
            {creator?.displayName ?? "The page creator"} (creator)
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto pt-1">
            {members
              .filter((m) => m.id !== creatorId)
              .map((m) => (
                <li key={m.id}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={selected.has(m.id)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(m.id);
                          else next.delete(m.id);
                          return next;
                        })
                      }
                    />
                    <span>{m.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      co-author
                    </span>
                  </label>
                </li>
              ))}
            {members.filter((m) => m.id !== creatorId).length === 0 && (
              <li className="text-muted-foreground">No other members yet.</li>
            )}
          </ul>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
