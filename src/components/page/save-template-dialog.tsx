"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAsTemplate } from "@/app/actions/templates";
import { TEMPLATE_CATEGORIES } from "@/lib/template-categories";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";

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
  const id = useId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogTitle>Save as template</DialogTitle>
        <DialogDescription>
          Anyone in this workspace can start a page from it. Give it a clear
          name and say who it&apos;s for.
        </DialogDescription>
        <form
          className="space-y-4"
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
          <Field label="Template name" htmlFor={`${id}-name`}>
            <Input
              id={`${id}-name`}
              name="name"
              placeholder="e.g. Supervision meeting note"
              required
              autoFocus
            />
          </Field>
          <Field label="One-line purpose" htmlFor={`${id}-purpose`} optional>
            <Input
              id={`${id}-purpose`}
              name="purpose"
              placeholder="What is it for?"
            />
          </Field>
          <Field label="Who it's for" htmlFor={`${id}-audience`} optional>
            <Input
              id={`${id}-audience`}
              name="audience"
              placeholder="e.g. CESR candidates"
            />
          </Field>
          <Field
            label="Description"
            htmlFor={`${id}-description`}
            optional
            hint="How to use it, in a sentence or two."
          >
            <Textarea id={`${id}-description`} name="description" rows={3} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor={`${id}-category`}>
              <NativeSelect
                id={`${id}-category`}
                name="category"
                defaultValue="Personal"
                className="w-full"
              >
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="What to include" htmlFor={`${id}-kind`}>
              <NativeSelect
                id={`${id}-kind`}
                name="kind"
                defaultValue="page"
                className="w-full"
              >
                <option value="page">This page only</option>
                <option value="tree">This page and its sub-pages</option>
              </NativeSelect>
            </Field>
          </div>
          {isPlatformOwner && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="scope"
                value="platform"
                className="size-4 accent-primary"
              />
              Platform template (curate into the gallery for everyone)
            </label>
          )}
          {error && (
            <Notice variant="destructive" title="Couldn't save the template">
              <p>{error}</p>
            </Notice>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
