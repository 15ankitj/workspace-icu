import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeading } from "@/components/ui/page-shell";

export default function NotFound() {
  return (
    <PageShell className="min-h-screen justify-center">
      <PageHeading title="Page not found">
        There is nothing at this address.
      </PageHeading>
      <div>
        <Button variant="secondary" asChild>
          <Link href="/">Go to your workspace</Link>
        </Button>
      </div>
    </PageShell>
  );
}
