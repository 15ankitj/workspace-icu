"use client";

import { useId, useState } from "react";
import { deleteMyAccount } from "@/app/actions/account";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

const PHRASE = "delete my account";

/**
 * The most irreversible action in the product: a visible label states the
 * phrase, the button stays disabled until it matches, and a confirmation
 * dialog still stands between the click and the deletion.
 */
export function DeleteAccountForm() {
  const [value, setValue] = useState("");
  const id = useId();
  const matches = value.trim().toLowerCase() === PHRASE;

  return (
    <form action={deleteMyAccount} className="space-y-3">
      <Field
        label={
          <>
            To confirm, type <span className="font-mono">{PHRASE}</span>
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
        title="Delete your account?"
        description="Your personal workspace and any workspace where you are the only member are erased, including files. This cannot be undone."
        confirmLabel="Delete my account"
      >
        Delete my account
      </ConfirmButton>
    </form>
  );
}
