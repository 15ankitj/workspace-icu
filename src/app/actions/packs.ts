"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json, TemplateKind } from "@/lib/database.types";
import packSnapshots from "../../../content/cesr-journey.snapshots.json";

interface PackEntry {
  name: string;
  purpose: string;
  description: string;
  category: string;
  audience: string;
  kind: TemplateKind;
  snapshot: unknown;
}

const PACKS = packSnapshots as PackEntry[];

/** Names of the bundled platform packs and which are already installed. */
export async function listPacks(): Promise<
  { name: string; purpose: string; kind: TemplateKind; installed: boolean }[]
> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("templates")
    .select("name")
    .eq("owner_scope", "platform")
    .in(
      "name",
      PACKS.map((p) => p.name),
    );
  const installed = new Set((existing ?? []).map((t) => t.name));
  return PACKS.map((p) => ({
    name: p.name,
    purpose: p.purpose,
    kind: p.kind,
    installed: installed.has(p.name),
  }));
}

/**
 * Install one bundled pack as a published platform template (platform
 * owner only — RLS refuses everyone else). The snapshot was authored in
 * content/ and built by scripts/build-cesr-pack.ts; from here on it is
 * edited in the app and republished like any other template.
 */
export async function installPack(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const pack = PACKS.find((p) => p.name === name);
  if (!pack) throw new Error("Unknown pack");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: existing } = await supabase
    .from("templates")
    .select("id")
    .eq("owner_scope", "platform")
    .eq("name", pack.name)
    .maybeSingle();
  if (existing) {
    revalidatePath(`/w/${workspaceId}/gallery`);
    return;
  }

  const { data: template, error } = await supabase
    .from("templates")
    .insert({
      owner_scope: "platform",
      workspace_id: null,
      name: pack.name,
      purpose: pack.purpose,
      description: pack.description,
      category: pack.category,
      audience: pack.audience,
      kind: pack.kind,
      is_published: true,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not install pack: ${error.message}`);

  const { data: version, error: versionError } = await supabase
    .from("template_versions")
    .insert({
      template_id: template.id,
      version: 1,
      snapshot: pack.snapshot as Json,
      changelog: "Initial version",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (versionError)
    throw new Error(`Could not install pack: ${versionError.message}`);

  await supabase
    .from("templates")
    .update({ current_version_id: version.id })
    .eq("id", template.id);
  await supabase.from("gallery_entries").upsert({
    template_id: template.id,
    category: pack.category,
    sort_order: PACKS.indexOf(pack),
  });
  await supabase.from("audit_events").insert({
    actor_id: user.id,
    workspace_id: null,
    event_type: "pack_installed",
    target_type: "template",
    target_id: template.id,
    metadata: { name: pack.name },
  });

  revalidatePath(`/w/${workspaceId}/gallery`);
}
