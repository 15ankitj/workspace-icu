"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAsTemplate } from "@/app/actions/templates";
import { TEMPLATE_CATEGORIES } from "@/lib/template-categories";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** "Save as template" (brief §10): page or page + descendants. */
export function SaveTemplateDialog({
  open,
  onOpenChange,
  workspaceId,
  pageId,
  isPlatformOwner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  pageId: string;
  isPlatformOwner: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Save as template</DialogTitle>
        <DialogDescription>
          Templates are content, not code: anyone in this workspace can start
          from it. Give it a clear name and say who it&apos;s for.
        </DialogDescription>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setError(null);
            startTransition(async () => {
              try {
                const { templateId } = await saveAsTemplate({
                  workspaceId,
                  sourcePageId: pageId,
                  kind: form.get("kind") === "tree" ? "tree" : "page",
                  scope:
                    form.get("scope") === "platform" ? "platform" : "workspace",
                  name: String(form.get("name") ?? ""),
                  purpose: String(form.get("purpose") ?? ""),
                  description: String(form.get("description") ?? ""),
                  category: String(form.get("category") ?? "Personal"),
                  audience: String(form.get("audience") ?? ""),
                });
                onOpenChange(false);
                router.push(`/w/${workspaceId}/gallery/${templateId}`);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not save");
              }
            });
          }}
        >
          <Input name="name" placeholder="Template name" required autoFocus />
          <Input
            name="purpose"
            placeholder="One-line purpose (e.g. Supervision meeting note)"
          />
          <Input
            name="audience"
            placeholder="Who it's for (e.g. CESR candidates)"
          />
          <textarea
            name="description"
            rows={3}
            placeholder="Longer description and how to use it"
            className="w-full rounded-md border border-input bg-transparent p-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              name="category"
              defaultValue="Personal"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              aria-label="Category"
            >
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              name="kind"
              defaultValue="page"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              aria-label="What to include"
            >
              <option value="page">This page only</option>
              <option value="tree">This page and its sub-pages</option>
            </select>
          </div>
          {isPlatformOwner && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="scope" value="platform" />
              Platform template (curate into the gallery for everyone)
            </label>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
