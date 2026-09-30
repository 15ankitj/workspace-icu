import type { ActionResult } from "@/lib/action-result";
import { toast } from "@/components/ui/toast";

/**
 * Await an action and show its failure, if any, as a destructive toast
 * under `title`; the result is returned either way. For calls that
 * previously had no error handling at all, where a failure was a silent
 * crash into the route's error boundary.
 */
export async function withFailureToast<T>(
  title: string,
  result: Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const r = await result;
  if (!r.ok) toast({ variant: "destructive", title, description: r.error });
  return r;
}
