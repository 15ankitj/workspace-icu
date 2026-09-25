"use client";

import Link from "next/link";
import { createReactBlockSpec } from "@blocknote/react";
import { FileText } from "lucide-react";
import { usePageLinkContext } from "@/components/editor/page-link-context";
import { PagePicker as SharedPagePicker } from "@/components/page/page-picker";

function PagePicker({
  onSelect,
}: {
  onSelect: (page: { id: string; title: string; icon: string | null }) => void;
}) {
  const { pages } = usePageLinkContext();
  return (
    <div
      contentEditable={false}
      className="rounded-md border border-dashed p-2"
    >
      <SharedPagePicker pages={pages} onPick={onSelect} />
    </div>
  );
}

function PageLinkCard({
  pageId,
  cachedTitle,
  cachedIcon,
}: {
  pageId: string;
  cachedTitle: string;
  cachedIcon: string;
}) {
  const { workspaceId, pages } = usePageLinkContext();
  // Live title/icon when the page is loaded in this workspace; the cached
  // copy keeps the block meaningful across workspaces and after deletion.
  const live = pages.find((p) => p.id === pageId);
  const title = live?.title || cachedTitle || "Untitled";
  const icon = (live ? live.icon : cachedIcon) || null;

  return (
    <Link
      href={`/w/${workspaceId}/p/${pageId}`}
      contentEditable={false}
      className="flex w-fit max-w-full items-center gap-2 rounded-md border px-3 py-1.5 text-sm no-underline hover:bg-accent"
    >
      {icon ? (
        <span className="w-4 text-center">{icon}</span>
      ) : (
        <FileText className="size-4 text-muted-foreground" />
      )}
      <span className="truncate font-medium">{title}</span>
    </Link>
  );
}

/** Block-level reference to another page; renders title and icon. */
export const createPageLinkSpec = createReactBlockSpec(
  {
    type: "pageLink",
    propSchema: {
      pageId: { default: "" },
      title: { default: "" },
      icon: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const { pageId, title, icon } = block.props as {
        pageId: string;
        title: string;
        icon: string;
      };
      if (!pageId) {
        return (
          <PagePicker
            onSelect={(page) =>
              editor.updateBlock(block, {
                props: {
                  pageId: page.id,
                  title: page.title,
                  icon: page.icon ?? "",
                },
              })
            }
          />
        );
      }
      return (
        <PageLinkCard pageId={pageId} cachedTitle={title} cachedIcon={icon} />
      );
    },
  },
);
