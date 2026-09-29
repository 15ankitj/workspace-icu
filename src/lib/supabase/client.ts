import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Browser client. The passkey opt-in is the only option: supabase-js keeps
 * WebAuthn behind `auth.experimental.passkey` while the API is unstable,
 * and every passkey call in the app goes through src/lib/passkeys.ts so
 * a change there touches one file. The server client needs no opt-in —
 * nothing on the server calls a passkey method.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { experimental: { passkey: true } } },
  );
}
