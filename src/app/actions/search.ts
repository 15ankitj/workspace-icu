"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fromSupabaseError,
  ok,
  runAction,
  type ActionResult,
} from "@/lib/action-result";

export interface SearchHit {
  id: string;
  workspaceId: string;
  title: string;
  icon: string | null;
  snippet: string;
}

/** Full-text search across every workspace the caller belongs to (RLS). */
export async function searchPages(
  query: string,
): Promise<ActionResult<{ hits: SearchHit[] }>> {
  return runAction(async () => {
    const q = query.trim().slice(0, 200);
    if (q.length < 2) return ok({ hits: [] });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/sign-in");

    const { data, error } = await supabase.rpc("search_pages", { p_query: q });
    if (error) return fromSupabaseError(error);
    return ok({
      hits: (data ?? []).map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        title: row.title,
        icon: row.icon,
        snippet: row.snippet,
      })),
    });
  });
}
