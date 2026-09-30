import type { ActionResult } from "@/lib/action-result";
import { toast } from "@/components/ui/toast";

/**
 * Await an action and show its failure, if any, as a destructive toast
 * under `title`. For fire-and-forget calls (a transition with nothing
 * to do on success) that previously had no error handling at all, where
 * a failure was a silent crash into the route's error boundary.
 */
export async function withFailureToast<T>(
  title: string,
  result: Promise<ActionResult<T>>,
): Promise<void> {
  const r = await result;
  if (!r.ok) toast({ variant: "destructive", title, description: r.error });
}
