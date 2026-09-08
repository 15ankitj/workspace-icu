import { comparePositions, firstPosition, positionAfter } from "@/lib/position";
import {
  flattenDocument,
  type BlockRowFromDb,
  type EditorBlock,
} from "@/lib/blocks";
import {
  propertiesForTemplate,
  type PageProperties,
} from "@/lib/page-properties";
import { SYNCED_BLOCK_TYPE } from "@/lib/synced";

/**
 * Template snapshots and instantiation (brief §10). Pure: the server
 * actions supply rows and ids; everything here is deterministic and
 * unit-tested. Page keys are the source page ids at snapshot time, which
 * keeps them stable across republishes of the same source tree.
 */

export interface SnapshotPage {
  key: string;
  parent_key: string | null;
  position: string;
  title: string;
  icon: string | null;
  cover_url: string | null;
  full_width: boolean;
  small_text: boolean;
  /** Page details (0014); absent in snapshots made before them. */
  description?: string;
  properties?: PageProperties;
  /** Authored content (Appendix A §2.2, format 3): a copy starts with
   *  non-authors in Suggest mode. Absent in older snapshots. */
  authored_content?: boolean;
  blocks: BlockRowFromDb[];
}

export interface SnapshotFile {
  /** The source file id, also the asset key under the template path. */
  key: string;
  filename: string;
  mime: string;
  size_bytes: number;
}

/**
 * A synced block carried by a template (Appendix A §1.3 rule 8). Its
 * placements in the snapshot's pages refer to it as `synced:<key>`.
 */
export interface SnapshotSynced {
  /** Stable key: the block's `template_key`, else its id at snapshot time. */
  key: string;
  /** Key of the source page when it is inside the snapshot; null when the
   *  block is expected to exist in the target workspace under this key. */
  source_key: string | null;
  title: string;
  /** Content at snapshot time — the seed for a new block, and the static
   *  copy used when the key cannot be resolved on instantiation. */
  blocks: EditorBlock[];
}

export interface TemplateSnapshot {
  /** 2 adds `synced`, 3 adds `authored_content` on pages; older formats
   *  are read as having neither. */
  format: 1 | 2 | 3;
  pages: SnapshotPage[];
  files: SnapshotFile[];
  synced?: SnapshotSynced[];
  /** What the snapshot builder had to change, for the changelog. */
  notes?: string[];
}

/** A synced block row as the saver sees it (RLS-visible ones only). */
export interface SourceSynced {
  id: string;
  source_page_id: string | null;
  template_key: string | null;
  title: string;
  blocks: EditorBlock[];
}

export interface SourcePage {
  id: string;
  parent_page_id: string | null;
  position: string;
  title: string;
  icon: string | null;
  cover_url: string | null;
  full_width: boolean;
  small_text: boolean;
  description?: string;
  properties?: unknown;
  authored_content?: boolean;
}

// Ids are whatever the caller generates (UUIDs in production); the
// pattern is deliberately format-agnostic so tests can use short ids.
const FILE_URL = /\/api\/files\/([A-Za-z0-9-]+)/g;

const SYNCED_REF = /^synced:(.+)$/;

function placementIdOf(row: BlockRowFromDb): string | null {
  if (row.type !== SYNCED_BLOCK_TYPE) return null;
  const id = row.content?.props?.syncedBlockId;
  return typeof id === "string" && id ? id : null;
}

function withPlacementId(row: BlockRowFromDb, id: string): BlockRowFromDb {
  return {
    ...row,
    content: {
      ...(row.content ?? {}),
      props: { ...(row.content?.props ?? {}), syncedBlockId: id },
    },
  };
}

/** Positions re-issued per parent in array order, after rows were spliced. */
function resequence(rows: BlockRowFromDb[]): BlockRowFromDb[] {
  const last = new Map<string | null, string>();
  return rows.map((row) => {
    const previous = last.get(row.parent_block_id) ?? null;
    const position = previous ? positionAfter(previous) : firstPosition();
    last.set(row.parent_block_id, position);
    return { ...row, position };
  });
}

/**
 * Replace a placement row with the rows of a document (a static copy of
 * the synced content), in its place among its siblings. Ids for the new
 * rows come from `newId`; positions are re-issued for the whole page.
 */
function flattenPlacement(
  rows: BlockRowFromDb[],
  index: number,
  document: EditorBlock[],
  newId: () => string,
): BlockRowFromDb[] {
  const placement = rows[index];
  const ids = new Map<string, string>();
  const copy = flattenDocument(document).map((row) => {
    const id = newId();
    ids.set(row.id, id);
    return { ...row, id };
  });
  const replacement = copy.map((row) => ({
    ...row,
    parent_block_id: row.parent_block_id
      ? (ids.get(row.parent_block_id) ?? placement.parent_block_id)
      : placement.parent_block_id,
  }));
  const out = rows.slice();
  out.splice(index, 1, ...replacement);
  return resequence(out);
}

function unavailableDocument(): EditorBlock[] {
  return [
    {
      id: "unavailable",
      type: "paragraph",
      props: {},
      content: [
        {
          type: "text",
          text: "(synced content was not available when this template was saved)",
          styles: { italic: true },
        },
      ],
    },
  ];
}

/**
 * Placements in a page's rows, for the snapshot: a block whose source is
 * inside the snapshot, or which carries a stable key, is kept as a
 * `synced:<key>` reference (and collected); any other is flattened to a
 * static copy, with a note (rule 8).
 */
function snapshotPlacements(
  rows: BlockRowFromDb[],
  syncedById: Map<string, SourceSynced>,
  pageKeys: Set<string>,
  entries: Map<string, SnapshotSynced>,
  notes: string[],
  newId: () => string,
): BlockRowFromDb[] {
  let out = rows
    .slice()
    .sort((a, b) => comparePositions(a.position, b.position));
  for (let index = 0; index < out.length; index++) {
    const id = placementIdOf(out[index]);
    if (!id) continue;
    const synced = syncedById.get(id.toLowerCase());
    const sourceKey =
      synced?.source_page_id &&
      pageKeys.has(synced.source_page_id.toLowerCase())
        ? synced.source_page_id.toLowerCase()
        : null;
    if (synced && (sourceKey || synced.template_key)) {
      const key = synced.template_key ?? synced.id.toLowerCase();
      if (!entries.has(key)) {
        entries.set(key, {
          key,
          source_key: sourceKey,
          title: synced.title,
          blocks: synced.blocks,
        });
      }
      out[index] = withPlacementId(out[index], `synced:${key}`);
      continue;
    }
    notes.push(
      synced
        ? `“${synced.title || "Synced block"}” was copied as ordinary content: its source page is outside this template.`
        : "A synced block that was not accessible was replaced by a note.",
    );
    out = flattenPlacement(
      out,
      index,
      synced ? synced.blocks : unavailableDocument(),
      newId,
    );
  }
  return out;
}

/** Internal page references become `key:<key>`; file URLs `file:<key>`. */
function rewriteForSnapshot(
  blocks: BlockRowFromDb[],
  pageKeys: Set<string>,
  fileKeys: Set<string>,
): BlockRowFromDb[] {
  const text = JSON.stringify(blocks);
  const rewritten = text
    .replace(FILE_URL, (match, id: string) => {
      fileKeys.add(id.toLowerCase());
      return `file:${id.toLowerCase()}`;
    })
    .replace(/"pageId":"([0-9a-f-]{36})"/gi, (match, id: string) =>
      pageKeys.has(id.toLowerCase())
        ? `"pageId":"key:${id.toLowerCase()}"`
        : match,
    );
  return JSON.parse(rewritten) as BlockRowFromDb[];
}

/**
 * Build a self-contained snapshot from a source tree. `pages` must all
 * belong to the tree (root first is not required; ordering is derived).
 */
export function buildSnapshot(
  pages: SourcePage[],
  blocksByPage: Map<string, BlockRowFromDb[]>,
  filesById: Map<string, Omit<SnapshotFile, "key">>,
  options: { synced?: SourceSynced[]; newId?: () => string } = {},
): TemplateSnapshot {
  const ids = new Set(pages.map((p) => p.id.toLowerCase()));
  const fileKeys = new Set<string>();
  const syncedById = new Map(
    (options.synced ?? []).map((row) => [row.id.toLowerCase(), row]),
  );
  const entries = new Map<string, SnapshotSynced>();
  const notes: string[] = [];
  let counter = 0;
  const newId = options.newId ?? (() => `flat-${++counter}`);

  // Parents before children, siblings in position order.
  const byParent = new Map<string | null, SourcePage[]>();
  for (const page of pages) {
    const parent =
      page.parent_page_id && ids.has(page.parent_page_id.toLowerCase())
        ? page.parent_page_id.toLowerCase()
        : null;
    const list = byParent.get(parent) ?? [];
    list.push(page);
    byParent.set(parent, list);
  }
  const ordered: SnapshotPage[] = [];
  const walk = (parent: string | null) => {
    for (const page of (byParent.get(parent) ?? [])
      .slice()
      .sort((a, b) => comparePositions(a.position, b.position))) {
      ordered.push({
        key: page.id.toLowerCase(),
        parent_key: parent,
        position: page.position,
        title: page.title,
        icon: page.icon,
        cover_url: page.cover_url,
        full_width: page.full_width,
        small_text: page.small_text,
        description: page.description ?? "",
        properties: propertiesForTemplate(page.properties),
        authored_content: page.authored_content === true,
        blocks: rewriteForSnapshot(
          snapshotPlacements(
            blocksByPage.get(page.id) ?? [],
            syncedById,
            ids,
            entries,
            notes,
            newId,
          ),
          ids,
          fileKeys,
        ),
      });
      walk(page.id.toLowerCase());
    }
  };
  walk(null);

  const files: SnapshotFile[] = [];
  for (const key of fileKeys) {
    const meta = filesById.get(key);
    if (meta) files.push({ key, ...meta });
  }

  return {
    format: 3,
    pages: ordered,
    files,
    synced: [...entries.values()],
    notes,
  };
}

export interface PlannedPage {
  id: string;
  workspace_id: string;
  parent_page_id: string | null;
  position: string;
  title: string;
  icon: string | null;
  cover_url: string | null;
  full_width: boolean;
  small_text: boolean;
  description: string;
  properties: PageProperties;
  /** The copy's creator (the instantiating user) is its author. */
  authored_content: boolean;
  template_id: string;
  template_version: number;
  template_page_key: string;
  blocks: BlockRowFromDb[];
}

export interface PlannedFile {
  key: string;
  newId: string;
  pageId: string;
  filename: string;
  mime: string;
  size_bytes: number;
}

export interface PlannedSynced {
  id: string;
  workspace_id: string;
  source_page_id: string;
  /** Null when the key is already taken in the workspace. */
  template_key: string | null;
  title: string;
  blocks: EditorBlock[];
}

export interface InstantiationPlan {
  pages: PlannedPage[];
  files: PlannedFile[];
  /** Synced blocks to create alongside the pages. */
  synced: PlannedSynced[];
  /** Placements that could not be resolved and were copied as content. */
  notes: string[];
  /** Id of the first top-level created page, to navigate to. */
  rootPageId: string | null;
}

/** Fresh ids throughout a nested document (a synced block's seed). */
function documentWithFreshIds(
  blocks: EditorBlock[],
  newId: () => string,
): EditorBlock[] {
  return blocks.map((block) => ({
    ...block,
    id: newId(),
    ...(block.children?.length && {
      children: documentWithFreshIds(block.children, newId),
    }),
  }));
}

/**
 * Plan an instantiation: new ids, remapped links, positions after the
 * existing siblings of the target parent. With `existingByKey` (pages in
 * the workspace already carrying this template's keys), only pages whose
 * key is absent are created — the "add the new pages" path — and their
 * parents resolve to the existing copies where present.
 */
export function planInstantiation(input: {
  snapshot: TemplateSnapshot;
  templateId: string;
  version: number;
  workspaceId: string;
  parentPageId: string | null;
  lastSiblingPosition: string | null;
  existingByKey?: Map<string, string>;
  /** Synced blocks already in the workspace, by stable key (rule 8). */
  existingSyncedByKey?: Map<string, string>;
  newId: () => string;
}): InstantiationPlan {
  const existing = input.existingByKey ?? new Map<string, string>();
  const keyToId = new Map<string, string>(existing);
  const created = new Set<string>();

  for (const page of input.snapshot.pages) {
    if (!keyToId.has(page.key)) {
      keyToId.set(page.key, input.newId());
      created.add(page.key);
    }
  }

  // Synced blocks: a source page created here gets a new block; otherwise
  // the key resolves to the workspace's existing block, or the placements
  // are copied as ordinary content.
  const existingSynced = input.existingSyncedByKey ?? new Map<string, string>();
  const entries = new Map(
    (input.snapshot.synced ?? []).map((entry) => [entry.key, entry]),
  );
  const syncedIds = new Map<string, string>();
  const synced: PlannedSynced[] = [];
  const notes: string[] = [];
  for (const entry of entries.values()) {
    const sourceCreated =
      entry.source_key !== null && created.has(entry.source_key);
    if (sourceCreated) {
      const id = input.newId();
      syncedIds.set(entry.key, id);
      synced.push({
        id,
        workspace_id: input.workspaceId,
        source_page_id: keyToId.get(entry.source_key!)!,
        template_key: existingSynced.has(entry.key) ? null : entry.key,
        title: entry.title,
        blocks: documentWithFreshIds(entry.blocks, input.newId),
      });
    } else if (existingSynced.has(entry.key)) {
      syncedIds.set(entry.key, existingSynced.get(entry.key)!);
    } else {
      notes.push(
        `“${entry.title || "Synced block"}” was copied as ordinary content: its synced source is not in this workspace.`,
      );
    }
  }

  const expandPlacements = (rows: BlockRowFromDb[]): BlockRowFromDb[] => {
    let out = rows.slice();
    for (let index = 0; index < out.length; index++) {
      const ref = placementIdOf(out[index])?.match(SYNCED_REF);
      if (!ref) continue;
      const key = ref[1];
      const id = syncedIds.get(key);
      if (id) {
        out[index] = withPlacementId(out[index], id);
        continue;
      }
      const entry = entries.get(key);
      out = flattenPlacement(
        out,
        index,
        entry ? entry.blocks : unavailableDocument(),
        input.newId,
      );
    }
    return out;
  };

  const fileIds = new Map<string, string>();
  for (const file of input.snapshot.files) fileIds.set(file.key, input.newId());

  const remap = (blocks: BlockRowFromDb[]): BlockRowFromDb[] => {
    const text = JSON.stringify(expandPlacements(blocks))
      .replace(/"pageId":"key:([0-9a-f-]{36})"/g, (match, key: string) => {
        const id = keyToId.get(key);
        return id ? `"pageId":"${id}"` : `"pageId":""`;
      })
      .replace(/file:([0-9a-f-]{36})/g, (match, key: string) => {
        const id = fileIds.get(key);
        return id ? `/api/files/${id}` : "";
      });
    const rewritten = JSON.parse(text) as BlockRowFromDb[];
    // Fresh row ids for every copy: block ids are a global primary key, so
    // a copy must never reuse the snapshot's ids (nor a source page's, for
    // workspace templates). One fresh id per row, so even a snapshot that
    // repeats an id instantiates cleanly; parent links follow the map.
    const freshIds = new Map<string, string>();
    const withIds = rewritten.map((block) => {
      const id = input.newId();
      freshIds.set(block.id, id);
      return { ...block, id };
    });
    return withIds.map((block, index) => {
      const parent = rewritten[index].parent_block_id;
      return {
        ...block,
        parent_block_id: parent ? (freshIds.get(parent) ?? null) : null,
      };
    });
  };

  let topPosition = input.lastSiblingPosition;
  const pages: PlannedPage[] = [];
  let rootPageId: string | null = null;

  for (const page of input.snapshot.pages) {
    if (!created.has(page.key)) continue;
    const id = keyToId.get(page.key)!;
    const parentExists = page.parent_key ? keyToId.has(page.parent_key) : false;
    const parentIsCreated = page.parent_key
      ? created.has(page.parent_key)
      : false;

    let parent_page_id: string | null;
    let position: string;
    if (page.parent_key && parentExists) {
      parent_page_id = keyToId.get(page.parent_key)!;
      // Under a freshly created parent the snapshot's own sibling order is
      // valid; under an existing page, append (its siblings are unknown
      // here, so the caller passes positions for existing parents via
      // lastSiblingPosition semantics only at the top level).
      position = parentIsCreated ? page.position : positionAfter(page.position);
    } else {
      parent_page_id = input.parentPageId;
      topPosition = topPosition ? positionAfter(topPosition) : firstPosition();
      position = topPosition;
      rootPageId ??= id;
    }

    pages.push({
      id,
      workspace_id: input.workspaceId,
      parent_page_id,
      position,
      title: page.title,
      icon: page.icon,
      cover_url: page.cover_url,
      full_width: page.full_width,
      small_text: page.small_text,
      description: page.description ?? "",
      properties: propertiesForTemplate(page.properties),
      authored_content: page.authored_content === true,
      template_id: input.templateId,
      template_version: input.version,
      template_page_key: page.key,
      blocks: remap(page.blocks),
    });
  }

  const referenced = new Set<string>();
  for (const page of pages) {
    for (const match of JSON.stringify(page.blocks).matchAll(FILE_URL)) {
      referenced.add(match[1].toLowerCase());
    }
  }
  const files: PlannedFile[] = [];
  for (const file of input.snapshot.files) {
    const newId = fileIds.get(file.key)!;
    if (!referenced.has(newId)) continue;
    const owner = pages.find((p) =>
      JSON.stringify(p.blocks).includes(`/api/files/${newId}`),
    );
    if (!owner) continue;
    files.push({
      key: file.key,
      newId,
      pageId: owner.id,
      filename: file.filename,
      mime: file.mime,
      size_bytes: file.size_bytes,
    });
  }

  return { pages, files, synced, notes, rootPageId };
}

/** Keys present in the newer snapshot but absent from the user's copy. */
export function missingPageKeys(
  snapshot: TemplateSnapshot,
  existingKeys: Iterable<string>,
): string[] {
  const have = new Set(existingKeys);
  return snapshot.pages.map((p) => p.key).filter((k) => !have.has(k));
}
