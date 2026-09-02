"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { instantiateTemplate } from "@/app/actions/templates";
import { Button } from "@/components/ui/button";

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
  const [result, setResult] = useState<string | null>(null);

  if (dismissed) return null;

  return (
    <div className="mb-4 rounded-md border bg-muted/40 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-muted-foreground" />
        <span>
          A newer version of the template <strong>{templateName}</strong> is
          available (v{latestVersion}; this page came from v{currentVersion}).
        </span>
        <span className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChanges((v) => !v)}
          >
            View changes
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const { created } = await instantiateTemplate({
                  templateId,
                  workspaceId,
                  parentPageId,
                  onlyMissing: true,
                });
                setResult(
                  created
                    ? `${created} new page${created === 1 ? "" : "s"} added.`
                    : "Your copy already has every page in the new version.",
                );
                router.refresh();
              })
            }
          >
            Add the new pages
          </Button>
          <Button variant="ghost" size="sm" onClick={() => dismiss(storageKey)}>
            Dismiss
          </Button>
        </span>
      </div>
      {showChanges && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {changes.map((c) => (
            <li key={c.version}>
              <strong>v{c.version}</strong>: {c.changelog || "No changelog"}
            </li>
          ))}
        </ul>
      )}
      {result && <p className="mt-2 text-xs">{result}</p>}
    </div>
  );
}
