import { strToU8, zipSync } from "fflate";
import type { createClient } from "@/lib/supabase/server";
import { buildDocument, type EditorBlock } from "@/lib/blocks";
import { blocksToMarkdown, fileIdsIn } from "@/lib/markdown";
import { planExport, relativeLink, safeFilename } from "@/lib/export";
import {
  exportNotes,
  loadMarkupExport,
  unresolvedSuggestionCounts,
} from "@/lib/markup-export";
import { loadSyncedForPages, type SyncedLookup } from "@/lib/synced-export";
import { syncedBlockIdsIn } from "@/lib/synced";
import { suggestionLabel } from "@/lib/suggestions";
import { suggestionIdsIn } from "@/lib/suggestion-markup";
import type { TreePage } from "@/lib/tree";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ArchiveOptions {
  /** Keep suggestion markup (Appendix A §2.4) instead of the clean state. */
  markup?: boolean;
}

/**
 * Build a zip of Markdown files (one per page, folders mirroring the
 * tree) with attached files alongside. Everything is read through RLS,
 * so nothing the caller cannot see is included. The clean state is the
 * default; with `markup` the pages are read from their stored Yjs
 * documents so open suggestions show as ins/del. Either way an
 * EXPORT-NOTES.md names the pages that still have suggestions waiting.
 */
export async function buildArchive(
  supabase: Supabase,
  selected: TreePage[],
  rootId: string | null,
  allPages: { id: string; title: string }[],
  options: ArchiveOptions = {},
): Promise<Uint8Array> {
  const entries = planExport(selected, rootId);
  const pathById = new Map(entries.map((e) => [e.page.id, e.path]));
  const titleById = new Map(allPages.map((p) => [p.id, p.title]));
  const pageIds = [...pathById.keys()];

  const { data: blockRows } = await supabase
    .from("blocks")
    .select("id, page_id, parent_block_id, type, position, content")
    .in("page_id", pageIds);
  const byPage = new Map<string, NonNullable<typeof blockRows>>();
  for (const row of blockRows ?? []) {
    const list = byPage.get(row.page_id) ?? [];
    list.push(row);
    byPage.set(row.page_id, list);
  }

  const files: Record<string, Uint8Array> = {};
  const fileNames = new Map<string, string>();
  const allFileIds = new Set<string>();
  // Synced blocks placed on the selected pages export as their current
  // content (Appendix A §1.3 rule 9), attachments included.
  const cleanSynced = await loadSyncedForPages(supabase, pageIds);
  const cleanDocuments = new Map(
    entries.map((e) => [e.page.id, buildDocument(byPage.get(e.page.id) ?? [])]),
  );
  const syncedIds = new Set<string>();
  for (const doc of cleanDocuments.values()) {
    for (const id of syncedBlockIdsIn(doc)) syncedIds.add(id);
  }

  const markup = options.markup
    ? await loadMarkupExport(supabase, pageIds, [...syncedIds])
    : null;
  const syncedBlock: SyncedLookup = (id) => {
    const clean = cleanSynced(id);
    if (!clean) return null;
    const marked = markup?.syncedBlocks.get(id);
    return marked ? { ...clean, blocks: marked } : clean;
  };
  const documents = new Map<string, EditorBlock[]>(
    entries.map((e) => {
      const doc =
        markup?.pageBlocks.get(e.page.id) ??
        cleanDocuments.get(e.page.id) ??
        [];
      for (const id of fileIdsIn(doc)) allFileIds.add(id);
      for (const syncedId of syncedBlockIdsIn(doc)) {
        const synced = syncedBlock(syncedId);
        if (synced)
          for (const id of fileIdsIn(synced.blocks)) allFileIds.add(id);
      }
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
      syncedBlock,
      suggester: markup?.suggester,
    });
    const title = `${entry.page.icon ? `${entry.page.icon} ` : ""}${entry.page.title || "Untitled"}`;
    const description = (entry.page as { description?: string }).description;
    const intro = description ? `_${description}_\n\n` : "";
    const trailer = markup
      ? suggestionIndex(doc, syncedBlock, markup.suggester)
      : "";
    files[`${entry.path}.md`] = strToU8(
      `# ${title}\n\n${intro}${markdown}${trailer}`,
    );
  }

  const counts = await unresolvedSuggestionCounts(supabase, pageIds);
  const notes = exportNotes(
    entries.map((e) => ({ id: e.page.id, title: e.page.title })),
    counts,
    Boolean(markup),
  );
  if (notes) files["EXPORT-NOTES.md"] = strToU8(notes);

  return zipSync(files, { level: 6 });
}

/** A closing list of the suggestions a marked-up page contains. */
function suggestionIndex(
  doc: EditorBlock[],
  syncedBlock: SyncedLookup,
  suggester: (id: string) => string | null,
): string {
  const ids = new Set(suggestionIdsIn(doc));
  for (const syncedId of syncedBlockIdsIn(doc)) {
    const synced = syncedBlock(syncedId);
    if (synced) for (const id of suggestionIdsIn(synced.blocks)) ids.add(id);
  }
  if (ids.size === 0) return "";
  const kinds = kindsById(doc, syncedBlock);
  const lines = [...ids].map((id, i) => {
    const shape = kinds.get(id);
    const label = shape ? suggestionLabel(shape) : "Suggestion";
    const who = suggester(id);
    return `${i + 1}. ${label}${who ? ` — ${who}` : ""}`;
  });
  return `\n## Suggestions in this export\n\n${lines.join("\n")}\n`;
}

function kindsById(doc: EditorBlock[], syncedBlock: SyncedLookup) {
  const out = new Map<
    string,
    {
      kinds: Set<"insertion" | "deletion" | "modification">;
      blockLevel: boolean;
    }
  >();
  const note = (
    id: string,
    kind: "insertion" | "deletion" | "modification",
    blockLevel: boolean,
  ) => {
    const cur = out.get(id) ?? { kinds: new Set(), blockLevel: false };
    cur.kinds.add(kind);
    cur.blockLevel = cur.blockLevel || blockLevel;
    out.set(id, cur);
  };
  const inline = (content: unknown) => {
    if (!Array.isArray(content)) return;
    for (const node of content) {
      const n = node as {
        type?: string;
        styles?: Record<string, unknown>;
        content?: unknown;
      };
      if (n?.type === "text") {
        const kind = n.styles?.["suggestion"];
        const id = n.styles?.["suggestionId"];
        if (
          (kind === "insertion" ||
            kind === "deletion" ||
            kind === "modification") &&
          typeof id === "string"
        )
          note(id, kind, false);
      } else if (n?.type === "link") inline(n.content);
    }
  };
  const walk = (blocks: EditorBlock[]) => {
    for (const block of blocks) {
      if (block.suggestion)
        note(block.suggestion.id, block.suggestion.kind, true);
      if (block.type === "table") {
        const rows =
          (block.content as { rows?: { cells?: unknown[] }[] } | undefined)
            ?.rows ?? [];
        for (const row of rows)
          for (const cell of row.cells ?? [])
            inline(
              cell && typeof cell === "object" && !Array.isArray(cell)
                ? (cell as { content?: unknown }).content
                : cell,
            );
      } else if (block.type === "syncedBlock") {
        const synced = syncedBlock(
          String(
            (block.props as { syncedBlockId?: unknown })?.syncedBlockId ?? "",
          ),
        );
        if (synced) walk(synced.blocks);
      } else inline(block.content);
      if (block.children?.length) walk(block.children);
    }
  };
  walk(doc);
  return out;
}

function extensionOf(filename: string): string {
  const match = filename.match(/\.[A-Za-z0-9]{1,8}$/);
  return match ? match[0].toLowerCase() : "";
}
