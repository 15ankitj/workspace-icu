import { Loader2 } from "lucide-react";

/** Root-level loading state: the landing redirect and public pages. */
export default function Loading() {
  return (
    <main
      className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground"
      aria-busy="true"
    >
      <Loader2 className="mr-2 size-4 motion-safe:animate-spin" aria-hidden />
      Loading…
    </main>
  );
}
