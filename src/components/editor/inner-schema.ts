"use client";

import { BlockNoteSchema } from "@blocknote/core";
import {
  baseBlockSpecs,
  baseInlineContentSpecs,
} from "@/components/editor/base-specs";

/** The schema of a synced block's own document: everything a page has
 *  except synced blocks themselves. */
export const innerSchema = BlockNoteSchema.create({
  blockSpecs: baseBlockSpecs,
  inlineContentSpecs: baseInlineContentSpecs,
});

export type InnerSchema = typeof innerSchema;
