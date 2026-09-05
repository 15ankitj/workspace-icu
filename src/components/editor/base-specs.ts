"use client";

import { defaultBlockSpecs, defaultInlineContentSpecs } from "@blocknote/core";
import { createCalloutSpec } from "@/components/editor/blocks/callout";
import { createEmbedSpec } from "@/components/editor/blocks/embed";
import { createBookmarkSpec } from "@/components/editor/blocks/bookmark";
import { createPageLinkSpec } from "@/components/editor/blocks/page-link";
import { createTocSpec } from "@/components/editor/blocks/toc";
import {
  pageMentionSpec,
  userMentionSpec,
} from "@/components/editor/inline/mentions";

// The v1 block list (brief §6): defaults minus audio/video, plus the
// custom blocks. Columns are deferred pending the licensing decision on
// BlockNote's multi-column extension. The synced block is added on top of
// this set by the page schema only — a synced block's own document uses
// this base set, which is what makes nesting impossible (Appendix A §1.2).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { audio, video, ...v1DefaultBlockSpecs } = defaultBlockSpecs;

export const baseBlockSpecs = {
  ...v1DefaultBlockSpecs,
  callout: createCalloutSpec(),
  embed: createEmbedSpec(),
  bookmark: createBookmarkSpec(),
  pageLink: createPageLinkSpec(),
  tableOfContents: createTocSpec(),
};

export const baseInlineContentSpecs = {
  ...defaultInlineContentSpecs,
  userMention: userMentionSpec,
  pageMention: pageMentionSpec,
};
