import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeading } from "@/components/ui/page-shell";

/** A page, template or workspace that does not exist or is not yours. */
export default function WorkspaceNotFound() {
  return (
    <PageShell>
      <PageHeading title="Not found">
        This page may have been moved to the trash, or you may not have access
        to it.
      </PageHeading>
      <div>
        <Button variant="secondary" asChild>
          <Link href="/">Go to your workspace</Link>
        </Button>
      </div>
    </PageShell>
  );
}
