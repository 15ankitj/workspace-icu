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
  /** Bundled version; a higher number than the installed one offers an update. */
  version?: number;
  changelog?: string;
  snapshot: unknown;
}

const PACKS = packSnapshots as PackEntry[];

/** The bundled platform packs: installed version (0 when absent) and the
 *  bundled one, so the gallery can offer Install or Update. */
export async function listPacks(): Promise<
  {
    name: string;
    purpose: string;
    kind: TemplateKind;
    installed: boolean;
    installedVersion: number;
    version: number;
  }[]
> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("templates")
    .select("name, template_versions!templates_current_version_fkey(version)")
    .eq("owner_scope", "platform")
    .in(
      "name",
      PACKS.map((p) => p.name),
    );
  const installed = new Map(
    (existing ?? []).map((t) => [t.name, t.template_versions?.version ?? 1]),
  );
  return PACKS.map((p) => ({
    name: p.name,
    purpose: p.purpose,
    kind: p.kind,
    installed: installed.has(p.name),
    installedVersion: installed.get(p.name) ?? 0,
    version: p.version ?? 1,
  }));
}

/**
 * Install one bundled pack as a published platform template (platform
 * owner only — RLS refuses everyone else), or add the bundled version to
 * an installed pack when it is newer. The snapshot was authored in
 * content/ and built by scripts/build-cesr-pack.ts; from here on it is
 * edited in the app and republished like any other template. Existing
 * copies are never modified: a new version reaches them through the
 * update banner.
 */
export async function installPack(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const pack = PACKS.find((p) => p.name === name);
  if (!pack) throw new Error("Unknown pack");
  const bundledVersion = pack.version ?? 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: existing } = await supabase
    .from("templates")
    .select("id, template_versions!templates_current_version_fkey(version)")
    .eq("owner_scope", "platform")
    .eq("name", pack.name)
    .maybeSingle();
  if (existing) {
    const current = existing.template_versions?.version ?? 1;
    if (bundledVersion > current) {
      const { data: added, error: addError } = await supabase
        .from("template_versions")
        .insert({
          template_id: existing.id,
          version: bundledVersion,
          snapshot: pack.snapshot as Json,
          changelog: (pack.changelog ?? "").slice(0, 2000),
          created_by: user.id,
        })
        .select("id")
        .single();
      if (addError) {
        throw new Error(`Could not update pack: ${addError.message}`);
      }
      await supabase
        .from("templates")
        .update({
          current_version_id: added.id,
          description: pack.description,
          purpose: pack.purpose,
        })
        .eq("id", existing.id);
      await supabase.from("audit_events").insert({
        actor_id: user.id,
        workspace_id: null,
        event_type: "pack_updated",
        target_type: "template",
        target_id: existing.id,
        metadata: { name: pack.name, version: bundledVersion },
      });
    }
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
      version: bundledVersion,
      snapshot: pack.snapshot as Json,
      changelog: pack.changelog || "Initial version",
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
    metadata: { name: pack.name, version: bundledVersion },
  });

  revalidatePath(`/w/${workspaceId}/gallery`);
}
