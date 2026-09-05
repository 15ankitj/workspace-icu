import { strToU8, zipSync } from "fflate";
import type { createClient } from "@/lib/supabase/server";
import { buildDocument } from "@/lib/blocks";
import { blocksToMarkdown, fileIdsIn } from "@/lib/markdown";
import { planExport, relativeLink, safeFilename } from "@/lib/export";
import type { TreePage } from "@/lib/tree";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Build a zip of Markdown files (one per page, folders mirroring the
 * tree) with attached files alongside. Everything is read through RLS,
 * so nothing the caller cannot see is included.
 */
export async function buildArchive(
  supabase: Supabase,
  selected: TreePage[],
  rootId: string | null,
  allPages: { id: string; title: string }[],
): Promise<Uint8Array> {
  const entries = planExport(selected, rootId);
  const pathById = new Map(entries.map((e) => [e.page.id, e.path]));
  const titleById = new Map(allPages.map((p) => [p.id, p.title]));

  const { data: blockRows } = await supabase
    .from("blocks")
    .select("id, page_id, parent_block_id, type, position, content")
    .in("page_id", [...pathById.keys()]);
  const byPage = new Map<string, NonNullable<typeof blockRows>>();
  for (const row of blockRows ?? []) {
    const list = byPage.get(row.page_id) ?? [];
    list.push(row);
    byPage.set(row.page_id, list);
  }

  const files: Record<string, Uint8Array> = {};
  const fileNames = new Map<string, string>();
  const allFileIds = new Set<string>();
  const documents = new Map(
    entries.map((e) => {
      const doc = buildDocument(byPage.get(e.page.id) ?? []);
      for (const id of fileIdsIn(doc)) allFileIds.add(id);
      return [e.page.id, doc];
    }),
  );

  if (allFileIds.size) {
    const { data: fileRows } = await supabase
      .from("files")
      .select("id, filename, storage_path")
      .in("id", [...allFileIds])
      .is("deleted_at", null);
    for (const f of fileRows ?? []) {
      const { data: blob } = await supabase.storage
        .from("files")
        .download(f.storage_path);
      if (!blob) continue;
      const name = `files/${f.id.slice(0, 8)}-${safeFilename(f.filename, "file")}${extensionOf(f.filename)}`;
      files[name] = new Uint8Array(await blob.arrayBuffer());
      fileNames.set(f.id, name);
    }
  }

  for (const entry of entries) {
    const doc = documents.get(entry.page.id) ?? [];
    const depthPrefix = "../".repeat(entry.path.split("/").length - 1);
    const markdown = blocksToMarkdown(doc, {
      pageTitle: (id) => titleById.get(id) ?? null,
      pageHref: (id) => {
        const target = pathById.get(id);
        return target ? relativeLink(entry.path, target) : `#${id}`;
      },
      fileHref: (id) => {
        const name = fileNames.get(id);
        return name ? `${depthPrefix}${name}` : "(attachment not included)";
      },
    });
    const title = `${entry.page.icon ? `${entry.page.icon} ` : ""}${entry.page.title || "Untitled"}`;
    const description = (entry.page as { description?: string }).description;
    const intro = description ? `_${description}_\n\n` : "";
    files[`${entry.path}.md`] = strToU8(`# ${title}\n\n${intro}${markdown}`);
  }

  return zipSync(files, { level: 6 });
}

function extensionOf(filename: string): string {
  const match = filename.match(/\.[A-Za-z0-9]{1,8}$/);
  return match ? match[0].toLowerCase() : "";
}
