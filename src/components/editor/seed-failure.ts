"use client";

import { toast } from "@/components/ui/toast";

/**
 * A failed seed is a page that looks empty while its content exists: say
 * so, to the console, to Sentry and to the person, rather than letting the
 * promise swallow it.
 */
export function reportSeedFailure(
  error: unknown,
  subject: "page" | "synced block",
) {
  console.error(
    `Could not load this ${subject}'s stored content into the editor:`,
    error,
  );
  // Loaded on demand: the editor schema reaches this module through the
  // synced block, and Sentry's bundle is not something every editor
  // import (or the jsdom test of the editor) should pay for.
  void import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.captureException(error, {
        tags: { feature: "editor-seed", subject },
      }),
    )
    .catch(() => {
      // Sentry unavailable: the console line above stands.
    });
  toast({
    variant: "destructive",
    title: `This ${subject}'s content could not be loaded`,
    description:
      "Its stored content is intact. Reload to try again; if this keeps happening, tell the workspace owner.",
  });
}
