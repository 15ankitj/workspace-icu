"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { instantiateTemplate } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";

const DISMISS_EVENT = "tpl-dismiss";

function subscribeToDismissals(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(DISMISS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DISMISS_EVENT, callback);
  };
}

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function dismiss(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Storage unavailable: the banner simply shows again next visit.
  }
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

/**
 * "A newer version of this template is available" (brief §10). Never
 * modifies the user's copy: "Add the new pages" only creates pages whose
 * template key is absent from this workspace.
 */
export function TemplateUpdateBanner({
  workspaceId,
  pageId,
  parentPageId,
  templateId,
  templateName,
  currentVersion,
  latestVersion,
  changes,
}: {
  workspaceId: string;
  pageId: string;
  parentPageId: string | null;
  templateId: string;
  templateName: string;
  currentVersion: number;
  latestVersion: number;
  changes: { version: number; changelog: string }[];
}) {
  const router = useRouter();
  const storageKey = `tpl-dismiss:${pageId}:${latestVersion}`;
  // Dismissal lives in localStorage; on the server (no storage) the banner
  // is hidden so hydration never flashes it for users who dismissed it.
  const dismissed = useSyncExternalStore(
    subscribeToDismissals,
    () => readDismissed(storageKey),
    () => true,
  );
  const [showChanges, setShowChanges] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  return (
    <Notice
      icon={<Sparkles className="size-4" />}
      title={`The template “${templateName}” has a newer version`}
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const { created } = await instantiateTemplate({
                    templateId,
                    workspaceId,
                    parentPageId,
                    onlyMissing: true,
                  });
                  toast({
                    title: created
                      ? `${created} new page${created === 1 ? "" : "s"} added`
                      : "Nothing to add",
                    description: created
                      ? "Your existing pages were not changed."
                      : "Your copy already has every page in the new version.",
                  });
                  router.refresh();
                } catch (error) {
                  toast({
                    variant: "destructive",
                    title: "Couldn't add the new pages",
                    description:
                      error instanceof Error
                        ? error.message
                        : "Please try again.",
                  });
                }
              })
            }
          >
            {isPending ? "Adding…" : "Add the new pages"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showChanges}
            onClick={() => setShowChanges((v) => !v)}
          >
            {showChanges ? "Hide changes" : "View changes"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => dismiss(storageKey)}>
            Dismiss
          </Button>
        </>
      }
    >
      <p>
        This page came from version {currentVersion}; version {latestVersion} is
        available. Adding the new pages never changes what you already have.
      </p>
      {showChanges && (
        <ul className="space-y-1 text-sm">
          {changes.map((c) => (
            <li key={c.version}>
              <strong>v{c.version}</strong>: {c.changelog || "No changelog"}
            </li>
          ))}
        </ul>
      )}
    </Notice>
  );
}
