"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/time";
import {
  MAX_PASSKEY_NAME_LENGTH,
  isSupported,
  list,
  register,
  remove,
  rename,
  type Passkey,
} from "@/lib/passkeys";
import {
  recordPasskeyRegistered,
  recordPasskeyRemoved,
} from "@/app/actions/passkeys";

const rowClass =
  "flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm";

/**
 * Settings → Your account → Passkeys: list, add, rename and remove the
 * signed-in user's passkeys. `enabled` is FEATURE_PASSKEYS from the server
 * page; off means nothing renders. The ceremonies and the list are
 * browser-side (src/lib/passkeys.ts); the audit rows are written by server
 * actions once a ceremony has succeeded.
 */
export function PasskeysBlock({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return <PasskeysManager />;
}

function PasskeysManager() {
  const supported = useSyncExternalStore(
    subscribeNever,
    isSupported,
    serverSnapshot,
  );
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"add" | string | null>(null);
  const [renaming, setRenaming] = useState<{
    id: string;
    value: string;
  } | null>(null);
  const renameId = useId();

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    list()
      .then((items) => {
        if (!cancelled) setPasskeys(items);
      })
      .catch((listError) => {
        if (!cancelled) setError(message(listError, "Could not load passkeys"));
      });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  if (!supported) {
    return (
      <div className="space-y-2">
        <Heading />
        <p className="text-sm text-muted-foreground">
          Passkeys aren&apos;t available in this browser.
        </p>
      </div>
    );
  }

  async function add() {
    setBusy("add");
    setError(null);
    try {
      const passkey = await register();
      if (!passkey) return; // Cancelled: nothing to say.
      setPasskeys((current) => [...(current ?? []), passkey]);
      const recorded = await recordPasskeyRegistered(passkey.id, passkey.name);
      if (!recorded.ok) setError(recorded.error);
    } catch (addError) {
      setError(message(addError, "Could not add a passkey"));
    } finally {
      setBusy(null);
    }
  }

  async function saveRename(passkey: Passkey) {
    if (!renaming) return;
    setBusy(passkey.id);
    setError(null);
    try {
      const updated = await rename(passkey.id, renaming.value);
      setPasskeys((current) =>
        (current ?? []).map((p) => (p.id === updated.id ? updated : p)),
      );
      setRenaming(null);
    } catch (renameError) {
      setError(message(renameError, "Could not rename the passkey"));
    } finally {
      setBusy(null);
    }
  }

  async function removePasskey(passkey: Passkey) {
    setBusy(passkey.id);
    setError(null);
    try {
      await remove(passkey.id);
      setPasskeys((current) =>
        (current ?? []).filter((p) => p.id !== passkey.id),
      );
      const recorded = await recordPasskeyRemoved(passkey.id, passkey.name);
      if (!recorded.ok) setError(recorded.error);
    } catch (removeError) {
      setError(message(removeError, "Could not remove the passkey"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <Heading />
      {passkeys === null ? (
        <p className="text-sm text-muted-foreground">Loading passkeys…</p>
      ) : passkeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No passkeys yet. Add one to sign in with your fingerprint, face or
          device PIN instead of an email.
        </p>
      ) : (
        <ul className="space-y-2">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className={rowClass}>
              {renaming?.id === passkey.id ? (
                <form
                  className="flex flex-1 flex-wrap items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveRename(passkey);
                  }}
                >
                  <label htmlFor={renameId} className="sr-only">
                    Passkey name
                  </label>
                  <Input
                    id={renameId}
                    autoFocus
                    required
                    maxLength={MAX_PASSKEY_NAME_LENGTH}
                    value={renaming.value}
                    onChange={(event) =>
                      setRenaming({ id: passkey.id, value: event.target.value })
                    }
                    className="max-w-xs"
                  />
                  <Button type="submit" size="sm" disabled={busy !== null}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRenaming(null)}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{passkey.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Added {formatDate(passkey.createdAt)} · Last used{" "}
                      {passkey.lastUsedAt
                        ? formatDate(passkey.lastUsedAt)
                        : "never"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() =>
                        setRenaming({ id: passkey.id, value: passkey.name })
                      }
                    >
                      Rename
                    </Button>
                    <ConfirmButton
                      size="sm"
                      disabled={busy !== null}
                      title="Remove this passkey?"
                      description={`"${passkey.name}" will no longer sign you in. You can still sign in by email, or add a passkey again later.`}
                      confirmLabel="Remove passkey"
                      onConfirm={() => void removePasskey(passkey)}
                    >
                      Remove
                    </ConfirmButton>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy !== null || passkeys === null}
          onClick={add}
        >
          {busy === "add" ? "Waiting for your device…" : "Add a passkey"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Email sign-in always works too.
        </span>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Heading() {
  return (
    <p className="text-sm">
      <span className="font-medium">Passkeys</span>
      <span className="block text-muted-foreground">
        Sign in with your fingerprint, face or device PIN, or a password
        manager, instead of an email link or code.
      </span>
    </p>
  );
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function subscribeNever() {
  return () => {};
}

function serverSnapshot() {
  return false;
}
