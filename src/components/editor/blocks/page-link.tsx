"use client";

import { useState } from "react";
import Link from "next/link";
import { createReactBlockSpec } from "@blocknote/react";
import { FileText } from "lucide-react";
import { usePageLinkContext } from "@/components/editor/page-link-context";
import { Input } from "@/components/ui/input";

function PagePicker({
  onSelect,
}: {
  onSelect: (page: { id: string; title: string; icon: string | null }) => void;
}) {
  const { pages } = usePageLinkContext();
  const [query, setQuery] = useState("");
  const matches = pages
    .filter((p) =>
      (p.title || "Untitled").toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 8);

  return (
    <div
      contentEditable={false}
      className="rounded-md border border-dashed p-2"
    >
      <Input
        autoFocus
        value={query}
        placeholder="Link to page…"
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="mt-1 max-h-56 overflow-y-auto">
        {matches.map((page) => (
          <li key={page.id}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent"
              onClick={() => onSelect(page)}
            >
              <span className="w-4 text-center">{page.icon ?? "📄"}</span>
              <span className="truncate">{page.title || "Untitled"}</span>
            </button>
          </li>
        ))}
        {matches.length === 0 && (
          <li className="px-2 py-1 text-xs text-muted-foreground">
            No matching pages.
          </li>
        )}
      </ul>
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
