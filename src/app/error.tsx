"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageShell, PageHeading } from "@/components/ui/page-shell";

/** Error boundary for routes outside a workspace (sign-in, share, print). */
export default function RootError({
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
    <PageShell className="min-h-screen justify-center">
      <PageHeading title="Something went wrong">
        The page could not be loaded.
      </PageHeading>
      <Notice
        variant="destructive"
        title="The error has been recorded"
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => retry()}>
              Try again
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/sign-in">Go to sign-in</Link>
            </Button>
          </>
        }
      >
        <p>
          If it keeps happening, contact support
          {error.digest ? ` quoting reference ${error.digest}` : ""}.
        </p>
      </Notice>
    </PageShell>
  );
}
