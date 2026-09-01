"use client";

import Link from "next/link";
import { createReactInlineContentSpec } from "@blocknote/react";
import { usePageLinkContext } from "@/components/editor/page-link-context";

function UserMentionChip({ name }: { name: string }) {
  return (
    <span className="rounded bg-accent px-1 font-medium text-accent-foreground">
      @{name}
    </span>
  );
}

/** Inline @mention of a workspace member. */
export const userMentionSpec = createReactInlineContentSpec(
  {
    type: "userMention",
    propSchema: {
      userId: { default: "" },
      name: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => (
      <UserMentionChip name={inlineContent.props.name || "someone"} />
    ),
  },
);

function PageMentionChip({
  pageId,
  cachedTitle,
  cachedIcon,
}: {
  pageId: string;
  cachedTitle: string;
  cachedIcon: string;
}) {
  const { workspaceId, pages } = usePageLinkContext();
  const live = pages.find((p) => p.id === pageId);
  const title = live?.title || cachedTitle || "Untitled";
  const icon = (live ? live.icon : cachedIcon) || "📄";

  return (
    <Link
      href={`/w/${workspaceId}/p/${pageId}`}
      className="rounded bg-accent px-1 font-medium text-accent-foreground no-underline hover:underline"
    >
      {icon} {title}
    </Link>
  );
}

/** Inline @mention of another page; renders title and icon. */
export const pageMentionSpec = createReactInlineContentSpec(
  {
    type: "pageMention",
    propSchema: {
      pageId: { default: "" },
      title: { default: "" },
      icon: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => (
      <PageMentionChip
        pageId={inlineContent.props.pageId}
        cachedTitle={inlineContent.props.title}
        cachedIcon={inlineContent.props.icon}
      />
    ),
  },
);
