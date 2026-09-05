"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { descendantIds } from "@/lib/tree";
import { comparePositions } from "@/lib/position";
import {
  buildSnapshot,
  planInstantiation,
  type SnapshotFile,
  type TemplateSnapshot,
} from "@/lib/templates";
import { TEMPLATE_CATEGORIES } from "@/lib/template-categories";
import type { Json, TemplateKind, TemplateScope } from "@/lib/database.types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  workspaceId: string | null,
  eventType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("audit_events").insert({
    actor_id: actorId,
    workspace_id: workspaceId,
    event_type: eventType,
    target_type: "template",
    target_id: targetId,
    metadata,
  });
}

const FILE_URL = /\/api\/files\/([0-9a-f-]{36})/gi;

export interface SaveTemplateInput {
  workspaceId: string;
  sourcePageId: string;
  kind: Exclude<TemplateKind, "workspace">;
  scope: TemplateScope;
  name: string;
  purpose: string;
  description: string;
  category: string;
  audience: string;
  /** Republish an existing template as a new version. */
  templateId?: string | null;
  changelog?: string;
}

/**
 * Snapshot a page (or page + descendants) into a template version (brief
 * §10). Assets referenced by the pages are copied under
 * template-assets/{template}/{version}/{file}.
 */
export async function saveAsTemplate(
  input: SaveTemplateInput,
): Promise<{ templateId: string; version: number }> {
  const { supabase, user } = await requireUser();
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("Give the template a name");
  const category = TEMPLATE_CATEGORIES.includes(
    input.category as (typeof TEMPLATE_CATEGORIES)[number],
  )
    ? input.category
    : "Personal";

  // Source tree (RLS-visible pages only).
  const { data: allPages, error: pagesError } = await supabase
    .from("pages")
    .select(
      "id, parent_page_id, position, title, icon, cover_url, full_width, small_text, is_private, created_by, description, properties",
    )
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null);
  if (pagesError) throw new Error(pagesError.message);
  const root = (allPages ?? []).find((p) => p.id === input.sourcePageId);
  if (!root) throw new Error("Page not found");
  const treeIds =
    input.kind === "tree"
      ? new Set([root.id, ...descendantIds(allPages ?? [], root.id)])
      : new Set([root.id]);
  const sourcePages = (allPages ?? [])
    .filter((p) => treeIds.has(p.id))
    .map((p) => ({
      ...p,
      // The root becomes a top-level template page.
      parent_page_id: p.id === root.id ? null : p.parent_page_id,
    }));

  const { data: blockRows } = await supabase
    .from("blocks")
    .select("id, page_id, parent_block_id, type, position, content")
    .in("page_id", [...treeIds]);
  const blocksByPage = new Map<string, NonNullable<typeof blockRows>>();
  for (const row of blockRows ?? []) {
    const list = blocksByPage.get(row.page_id) ?? [];
    list.push(row);
    blocksByPage.set(row.page_id, list);
  }

  // Files referenced by the pages' blocks.
  const fileIds = new Set<string>();
  for (const match of JSON.stringify(blockRows ?? []).matchAll(FILE_URL)) {
    fileIds.add(match[1].toLowerCase());
  }
  const { data: fileRows } = fileIds.size
    ? await supabase
        .from("files")
        .select("id, filename, mime, size_bytes, storage_path")
        .in("id", [...fileIds])
        .is("deleted_at", null)
    : { data: [] };
  const filesById = new Map<string, Omit<SnapshotFile, "key">>();
  for (const f of fileRows ?? []) {
    filesById.set(f.id.toLowerCase(), {
      filename: f.filename,
      mime: f.mime,
      size_bytes: f.size_bytes,
    });
  }

  const snapshot = buildSnapshot(sourcePages, blocksByPage, filesById);

  // Template row (new or existing) and the next version number.
  let templateId = input.templateId ?? null;
  let version = 1;
  if (templateId) {
    const { data: latest } = await supabase
      .from("template_versions")
      .select("version")
      .eq("template_id", templateId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    version = (latest?.version ?? 0) + 1;
  } else {
    const { data: created, error } = await supabase
      .from("templates")
      .insert({
        owner_scope: input.scope,
        workspace_id: input.scope === "workspace" ? input.workspaceId : null,
        source_page_id: root.id,
        name,
        purpose: input.purpose.trim().slice(0, 200),
        description: input.description.trim().slice(0, 4000),
        category,
        audience: input.audience.trim().slice(0, 200),
        kind: input.kind,
        is_published: input.scope === "workspace",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create template: ${error.message}`);
    templateId = created.id;
  }

  const { data: versionRow, error: versionError } = await supabase
    .from("template_versions")
    .insert({
      template_id: templateId,
      version,
      snapshot: snapshot as unknown as Json,
      changelog: (
        input.changelog ?? (version === 1 ? "Initial version" : "")
      ).slice(0, 2000),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (versionError) {
    throw new Error(`Could not save template version: ${versionError.message}`);
  }
  await supabase
    .from("templates")
    .update({ current_version_id: versionRow.id, source_page_id: root.id })
    .eq("id", templateId);

  // Copy assets; a failed copy leaves that file out of the template.
  for (const f of fileRows ?? []) {
    const { error } = await supabase.storage
      .from("files")
      .copy(f.storage_path, `${templateId}/${version}/${f.id.toLowerCase()}`, {
        destinationBucket: "template-assets",
      });
    if (error) console.error("Template asset copy failed:", error.message);
  }

  await audit(
    supabase,
    user.id,
    input.scope === "workspace" ? input.workspaceId : null,
    version === 1 ? "template_created" : "template_republished",
    templateId,
    {
      version,
      kind: input.kind,
      scope: input.scope,
      pages: snapshot.pages.length,
    },
  );

  revalidatePath(`/w/${input.workspaceId}/gallery`);
  return { templateId, version };
}

/**
 * "Start with this template": deep copy into a workspace with new ids,
 * links remapped, assets copied, provenance recorded (brief §10). With
 * onlyMissing, adds just the pages the user's copy lacks.
 */
export async function instantiateTemplate(input: {
  templateId: string;
  workspaceId: string;
  parentPageId: string | null;
  onlyMissing?: boolean;
}): Promise<{ pageId: string | null; created: number }> {
  const { supabase, user } = await requireUser();

  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("id, name, current_version_id, owner_scope, workspace_id")
    .eq("id", input.templateId)
    .single();
  if (templateError || !template?.current_version_id) {
    throw new Error("Template not found");
  }
  const { data: versionRow } = await supabase
    .from("template_versions")
    .select("version, snapshot")
    .eq("id", template.current_version_id)
    .single();
  if (!versionRow) throw new Error("Template version not found");
  const snapshot = versionRow.snapshot as unknown as TemplateSnapshot;

  const { data: siblings } = await supabase
    .from("pages")
    .select("id, position, parent_page_id, template_id, template_page_key")
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null);
  const lastSibling = (siblings ?? [])
    .filter((p) => p.parent_page_id === input.parentPageId)
    .sort((a, b) => comparePositions(a.position, b.position))
    .at(-1);

  const existingByKey = new Map<string, string>();
  if (input.onlyMissing) {
    for (const p of siblings ?? []) {
      if (p.template_id === template.id && p.template_page_key) {
        existingByKey.set(p.template_page_key, p.id);
      }
    }
  }

  const plan = planInstantiation({
    snapshot,
    templateId: template.id,
    version: versionRow.version,
    workspaceId: input.workspaceId,
    parentPageId: input.parentPageId,
    lastSiblingPosition: lastSibling?.position ?? null,
    existingByKey: input.onlyMissing ? existingByKey : undefined,
    newId: () => randomUUID(),
  });

  if (plan.pages.length === 0) return { pageId: null, created: 0 };

  const { error } = await supabase.rpc("insert_template_pages", {
    p_pages: plan.pages as unknown as Json,
  });
  if (error) throw new Error(`Could not create pages: ${error.message}`);

  for (const file of plan.files) {
    const dest = `${input.workspaceId}/${file.pageId}/${file.newId}`;
    const { error: copyError } = await supabase.storage
      .from("template-assets")
      .copy(`${template.id}/${versionRow.version}/${file.key}`, dest, {
        destinationBucket: "files",
      });
    if (copyError) {
      console.error("Template asset copy failed:", copyError.message);
      continue;
    }
    await supabase.from("files").insert({
      id: file.newId,
      workspace_id: input.workspaceId,
      page_id: file.pageId,
      uploader_id: user.id,
      storage_path: dest,
      filename: file.filename,
      mime: file.mime,
      size_bytes: file.size_bytes,
      phi_scan_status: "not_scanned",
      aup_acknowledged: true,
    });
  }

  await audit(
    supabase,
    user.id,
    input.workspaceId,
    "template_instantiated",
    template.id,
    {
      version: versionRow.version,
      pages: plan.pages.length,
      only_missing: Boolean(input.onlyMissing),
    },
  );

  revalidatePath(`/w/${input.workspaceId}`, "layout");
  return { pageId: plan.rootPageId, created: plan.pages.length };
}

/** Form wrapper: start from a template at the workspace root. */
export async function startFromTemplate(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const { pageId } = await instantiateTemplate({
    templateId,
    workspaceId,
    parentPageId: null,
  });
  redirect(pageId ? `/w/${workspaceId}/p/${pageId}` : `/w/${workspaceId}`);
}

/** Platform owner: publish to / deprecate from the gallery. */
export async function setTemplatePublished(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const published = String(formData.get("published") ?? "") === "true";
  const { supabase, user } = await requireUser();

  const { data: template, error } = await supabase
    .from("templates")
    .update({ is_published: published })
    .eq("id", templateId)
    .select("id, category, owner_scope")
    .single();
  if (error) throw new Error(`Could not update template: ${error.message}`);

  if (template.owner_scope === "platform") {
    if (published) {
      await supabase
        .from("gallery_entries")
        .upsert({ template_id: templateId, category: template.category });
    } else {
      await supabase
        .from("gallery_entries")
        .delete()
        .eq("template_id", templateId);
    }
  }
  await audit(
    supabase,
    user.id,
    null,
    published ? "template_published" : "template_deprecated",
    templateId,
  );
  revalidatePath(`/w/${workspaceId}/gallery`);
}

export async function deleteTemplate(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", templateId);
  if (error) throw new Error(`Could not delete template: ${error.message}`);
  await audit(supabase, user.id, null, "template_deleted", templateId);
  redirect(`/w/${workspaceId}/gallery`);
}

/** Republish from the template's source page with a changelog. */
export async function republishTemplate(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const changelog = String(formData.get("changelog") ?? "");
  const { supabase } = await requireUser();

  const { data: template } = await supabase
    .from("templates")
    .select(
      "id, source_page_id, owner_scope, workspace_id, name, purpose, description, category, audience, kind",
    )
    .eq("id", templateId)
    .single();
  if (!template?.source_page_id) {
    throw new Error("This template's source page is no longer available");
  }
  const { data: source } = await supabase
    .from("pages")
    .select("workspace_id")
    .eq("id", template.source_page_id)
    .single();
  if (!source) throw new Error("Source page not found");

  await saveAsTemplate({
    workspaceId: source.workspace_id,
    sourcePageId: template.source_page_id,
    kind: template.kind === "page" ? "page" : "tree",
    scope: template.owner_scope,
    name: template.name,
    purpose: template.purpose,
    description: template.description,
    category: template.category,
    audience: template.audience,
    templateId: template.id,
    changelog,
  });
  revalidatePath(`/w/${workspaceId}/gallery/${templateId}`);
}
