import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. Always user-scoped (anon key + session cookie): RLS is the
 * authorisation boundary and the service-role key is never used in paths
 * that serve end users.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only;
            // the proxy refreshes sessions so this is safe to ignore.
          }
        },
      },
    },
  );
}
