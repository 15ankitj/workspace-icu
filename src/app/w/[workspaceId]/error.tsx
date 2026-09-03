"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageShell, PageHeading } from "@/components/ui/page-shell";

/** Error boundary for everything inside a workspace; the sidebar stays. */
export default function WorkspaceError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell>
      <PageHeading title="Something went wrong">
        This page could not be loaded. Your content has not been changed.
      </PageHeading>
      <Notice
        variant="destructive"
        title="The error has been recorded"
        actions={
          <Button type="button" variant="secondary" onClick={() => retry()}>
            Try again
          </Button>
        }
      >
        <p>
          If it keeps happening, sign out and back in, or contact support
          {error.digest ? ` quoting reference ${error.digest}` : ""}.
        </p>
      </Notice>
    </PageShell>
  );
}
