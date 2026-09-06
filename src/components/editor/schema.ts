"use client";

import { BlockNoteSchema } from "@blocknote/core";
import {
  baseBlockSpecs,
  baseInlineContentSpecs,
} from "@/components/editor/base-specs";
import { createSyncedBlockSpec } from "@/components/editor/blocks/synced-block";

/** The page schema: the base block set plus synced block placements. */
export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...baseBlockSpecs,
    syncedBlock: createSyncedBlockSpec(),
  },
  inlineContentSpecs: baseInlineContentSpecs,
});

export type EditorSchema = typeof editorSchema;
