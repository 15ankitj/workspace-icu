import { Suspense } from "react";
import { flags } from "@/lib/flags";
import { SignInForm } from "./sign-in-form";

/** Reads the passkey flag on the server; the form is a client component. */
export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm passkeysEnabled={flags.passkeys} />
    </Suspense>
  );
}
