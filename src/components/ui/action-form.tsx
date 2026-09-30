"use client";

import * as React from "react";
import { useActionState } from "react";
import type { ActionResult, FormState } from "@/lib/action-result";

export type FormAction = (
  state: FormState,
  formData: FormData,
) => Promise<ActionResult>;

/**
 * A `<form>` whose server action returns an ActionResult: the failure's
 * sentence renders inline under the fields, where before it was lost to
 * the route's error boundary as an unreadable digest. Works inside a
 * server component (the action reference is serialisable) and keeps
 * SubmitButton's pending state, which reads the form's status.
 */
export function ActionForm({
  action,
  children,
  ...props
}: Omit<React.ComponentProps<"form">, "action"> & { action: FormAction }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} {...props}>
      {children}
      {state && !state.ok && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
