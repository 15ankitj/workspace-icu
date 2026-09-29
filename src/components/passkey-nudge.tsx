"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { isSupported, list, register } from "@/lib/passkeys";
import {
  dismissPasskeyNudge,
  recordPasskeyRegistered,
} from "@/app/actions/passkeys";

/**
 * The one-time offer to add a passkey, rendered by the workspace layout
 * (which every signed-in page sits under, and the sign-in, invite and
 * continue pages do not). It shows only when the flag is on and the user
 * has not dismissed it (`show`, decided on the server), the browser has
 * WebAuthn, and the user has no passkey yet. The layout stays mounted
 * across page navigations, so the passkey list is fetched once, on mount.
 * "Not now" hides the card at once and stamps the user's row in the
 * background; a successful add stamps it too, after a brief confirmation.
 */
export function PasskeyNudge({ show }: { show: boolean }) {
  const supported = useSyncExternalStore(
    subscribeNever,
    isSupported,
    serverSnapshot,
  );
  const [state, setState] = useState<
    "checking" | "hidden" | "offer" | "adding" | "added"
  >("checking");
  const [addedName, setAddedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!show || !supported) return;
    let cancelled = false;
    list()
      .then((passkeys) => {
        if (!cancelled && passkeys.length === 0) setState("offer");
      })
      .catch(() => {
        // Could not check (offline, passkeys disabled server-side): stay
        // hidden rather than nag.
      });
    return () => {
      cancelled = true;
    };
  }, [show, supported]);

  useEffect(() => {
    if (state !== "added") return;
    const timer = setTimeout(() => setState("hidden"), 8000);
    return () => clearTimeout(timer);
  }, [state]);

  if (!show || !supported) return null;
  if (state === "checking" || state === "hidden") return null;

  function notNow() {
    setState("hidden");
    dismissPasskeyNudge().catch(() => {
      // Best effort: the card is already gone for this visit.
    });
  }

  async function addPasskey() {
    setState("adding");
    setError(null);
    try {
      const passkey = await register();
      if (!passkey) {
        // The user closed the prompt: keep offering, say nothing.
        setState("offer");
        return;
      }
      setAddedName(passkey.name);
      setState("added");
      await Promise.all([
        recordPasskeyRegistered(passkey.id, passkey.name),
        dismissPasskeyNudge(),
      ]).catch(() => {
        // The passkey exists regardless; the audit row is best effort here.
      });
    } catch (registerError) {
      setState("offer");
      setError(
        registerError instanceof Error
          ? registerError.message
          : "Could not add a passkey",
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-4">
      {state === "added" ? (
        <Notice
          title={`Passkey added: ${addedName ?? "Passkey"}`}
          actions={
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setState("hidden")}
            >
              Done
            </Button>
          }
        >
          <p>
            Next time, choose &ldquo;Sign in with a passkey&rdquo; on the
            sign-in page. You can rename or remove it under Settings.
          </p>
        </Notice>
      ) : (
        <Notice
          title="Sign in faster next time"
          actions={
            <>
              <Button
                type="button"
                size="sm"
                disabled={state === "adding"}
                onClick={addPasskey}
              >
                {state === "adding"
                  ? "Waiting for your device…"
                  : "Add a passkey"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={state === "adding"}
                onClick={notNow}
              >
                Not now
              </Button>
            </>
          }
        >
          <p>
            Add a passkey and use your fingerprint, face or device PIN instead
            of waiting for an email. You can always still sign in by email.
          </p>
          {error && (
            <p className="text-destructive" role="alert">
              {error}
            </p>
          )}
        </Notice>
      )}
    </div>
  );
}

function subscribeNever() {
  return () => {};
}

function serverSnapshot() {
  return false;
}
