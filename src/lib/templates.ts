import { comparePositions, firstPosition, positionAfter } from "@/lib/position";
import type { BlockRowFromDb } from "@/lib/blocks";

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
  blocks: BlockRowFromDb[];
}

export interface SnapshotFile {
  /** The source file id, also the asset key under the template path. */
  key: string;
  filename: string;
  mime: string;
  size_bytes: number;
}

export interface TemplateSnapshot {
  format: 1;
  pages: SnapshotPage[];
  files: SnapshotFile[];
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
}

// Ids are whatever the caller generates (UUIDs in production); the
// pattern is deliberately format-agnostic so tests can use short ids.
const FILE_URL = /\/api\/files\/([A-Za-z0-9-]+)/g;

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
): TemplateSnapshot {
  const ids = new Set(pages.map((p) => p.id.toLowerCase()));
  const fileKeys = new Set<string>();

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
        blocks: rewriteForSnapshot(
          blocksByPage.get(page.id) ?? [],
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

  return { format: 1, pages: ordered, files };
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

export interface InstantiationPlan {
  pages: PlannedPage[];
  files: PlannedFile[];
  /** Id of the first top-level created page, to navigate to. */
  rootPageId: string | null;
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

  const fileIds = new Map<string, string>();
  for (const file of input.snapshot.files) fileIds.set(file.key, input.newId());

  const remap = (blocks: BlockRowFromDb[]): BlockRowFromDb[] => {
    const text = JSON.stringify(blocks)
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

  return { pages, files, rootPageId };
}

/** Keys present in the newer snapshot but absent from the user's copy. */
export function missingPageKeys(
  snapshot: TemplateSnapshot,
  existingKeys: Iterable<string>,
): string[] {
  const have = new Set(existingKeys);
  return snapshot.pages.map((p) => p.key).filter((k) => !have.has(k));
}
