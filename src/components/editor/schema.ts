"use client";

import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { createCalloutSpec } from "@/components/editor/blocks/callout";
import { createEmbedSpec } from "@/components/editor/blocks/embed";
import { createBookmarkSpec } from "@/components/editor/blocks/bookmark";
import { createPageLinkSpec } from "@/components/editor/blocks/page-link";
import { createTocSpec } from "@/components/editor/blocks/toc";

// The v1 block list (brief §6): defaults minus audio/video, plus the
// custom blocks. Columns are deferred pending the licensing decision on
// BlockNote's multi-column extension.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { audio, video, ...v1DefaultBlockSpecs } = defaultBlockSpecs;

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...v1DefaultBlockSpecs,
    callout: createCalloutSpec(),
    embed: createEmbedSpec(),
    bookmark: createBookmarkSpec(),
    pageLink: createPageLinkSpec(),
    tableOfContents: createTocSpec(),
  },
});

export type EditorSchema = typeof editorSchema;
