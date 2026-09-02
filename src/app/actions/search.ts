"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SearchHit {
  id: string;
  workspaceId: string;
  title: string;
  icon: string | null;
  snippet: string;
}

/** Full-text search across every workspace the caller belongs to (RLS). */
export async function searchPages(query: string): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 200);
  if (q.length < 2) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data, error } = await supabase.rpc("search_pages", { p_query: q });
  if (error) throw new Error(`Search failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    icon: row.icon,
    snippet: row.snippet,
  }));
}
