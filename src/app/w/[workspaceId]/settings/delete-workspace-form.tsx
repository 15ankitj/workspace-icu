"use client";

import { useActionState, useId, useState } from "react";
import { deleteWorkspace } from "@/app/actions/workspaces";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

/**
 * Deleting a workspace takes everything in it: the owner types its name,
 * and a confirmation dialog still stands between the click and the
 * deletion. The database holds the real rule (owner, and nobody else in
 * the workspace); this form is only offered when it would pass.
 */
export function DeleteWorkspaceForm({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const [value, setValue] = useState("");
  const [state, formAction] = useActionState(deleteWorkspace, null);
  const id = useId();
  const matches =
    value.trim().toLowerCase() === workspaceName.trim().toLowerCase();

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <Field
        label={
          <>
            To confirm, type <span className="font-mono">{workspaceName}</span>
          </>
        }
        htmlFor={id}
      >
        <Input
          id={id}
          name="confirm"
          required
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="max-w-xs"
        />
      </Field>
      <ConfirmButton
        variant="destructive"
        disabled={!matches}
        title={`Delete ${workspaceName}?`}
        description="Every page and file in this workspace goes with it. You can restore it from workspace settings for 30 days; after that it is removed permanently."
        confirmLabel="Delete workspace"
      >
        Delete workspace
      </ConfirmButton>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
