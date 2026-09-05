import type { ReactNode } from "react";
import type { EditorBlock } from "@/lib/blocks";
import { calloutClass } from "@/lib/callout";

/**
 * Static, server-safe rendering of a block document (print/PDF view,
 * previews). Mirrors the Markdown serializer's coverage of the v1 blocks.
 */

export interface RenderContext {
  pageHref: (pageId: string) => string;
  pageTitle: (pageId: string) => string | null;
  /** Content of a synced block when the renderer could load it; null or
   *  absent renders a neutral placeholder. */
  syncedBlock?: (
    id: string,
  ) => { blocks: EditorBlock[]; sourceTitle: string | null } | null;
}

const FILE_URL = /^\/api\/files\/[A-Za-z0-9-]+$/;

function Inline({ content, ctx }: { content: unknown; ctx: RenderContext }) {
  if (!Array.isArray(content)) return null;
  return (
    <>
      {content.map((node, i) => {
        if (!node || typeof node !== "object") return null;
        const n = node as {
          type?: string;
          text?: string;
          styles?: Record<string, unknown>;
          href?: string;
          content?: unknown;
          props?: Record<string, unknown>;
        };
        switch (n.type) {
          case "text": {
            let el: ReactNode = n.text;
            const s = n.styles ?? {};
            if (s.code) el = <code>{el}</code>;
            if (s.bold) el = <strong>{el}</strong>;
            if (s.italic) el = <em>{el}</em>;
            if (s.underline) el = <u>{el}</u>;
            if (s.strike) el = <s>{el}</s>;
            return <span key={i}>{el}</span>;
          }
          case "link":
            return (
              <a key={i} href={n.href} className="underline">
                <Inline content={n.content} ctx={ctx} />
              </a>
            );
          case "userMention":
            return (
              <span key={i} className="rounded bg-accent px-1">
                @{String(n.props?.name ?? "someone")}
              </span>
            );
          case "pageMention": {
            const id = String(n.props?.pageId ?? "");
            return (
              <a key={i} href={ctx.pageHref(id)} className="underline">
                {ctx.pageTitle(id) ?? String(n.props?.title ?? "page")}
              </a>
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}

function cellContent(cell: unknown): unknown {
  return cell && typeof cell === "object" && !Array.isArray(cell)
    ? (cell as { content?: unknown }).content
    : cell;
}

function Block({ block, ctx }: { block: EditorBlock; ctx: RenderContext }) {
  const props = (block.props ?? {}) as Record<string, unknown>;
  const children = block.children?.length ? (
    <div className="ml-6">
      <Blocks blocks={block.children} ctx={ctx} />
    </div>
  ) : null;
  const inline = <Inline content={block.content} ctx={ctx} />;

  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(Number(props.level) || 1, 1), 3);
      const sizes = [
        "text-2xl font-bold",
        "text-xl font-semibold",
        "text-lg font-semibold",
      ];
      const Tag = `h${level}` as "h1" | "h2" | "h3";
      return (
        <>
          <Tag className={`${sizes[level - 1]} mt-4`}>{inline}</Tag>
          {children}
        </>
      );
    }
    case "checkListItem":
      return (
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={Boolean(props.checked)}
            readOnly
            className="mt-1"
          />
          <div className="flex-1">
            <div>{inline}</div>
            {children}
          </div>
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 pl-3 italic text-muted-foreground">
          {inline}
          {children}
        </blockquote>
      );
    case "callout":
      return (
        <div
          className={`flex gap-2 rounded-md border-l-4 p-3 ${calloutClass(props.colour)}`}
        >
          <span aria-hidden>{String(props.emoji ?? "💡")}</span>
          <div className="flex-1">
            <div>{inline}</div>
            {children}
          </div>
        </div>
      );
    case "divider":
      return <hr className="my-4" />;
    case "codeBlock": {
      const code = Array.isArray(block.content)
        ? block.content.map((c) => (c as { text?: string }).text ?? "").join("")
        : "";
      return (
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-sm">
          <code>{code}</code>
        </pre>
      );
    }
    case "table": {
      const rows =
        (block.content as { rows?: { cells?: unknown[] }[] } | undefined)
          ?.rows ?? [];
      return (
        <table className="my-2 w-full border-collapse text-sm">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {(row.cells ?? []).map((cell, c) => (
                  <td key={c} className="border px-2 py-1 align-top">
                    <Inline content={cellContent(cell)} ctx={ctx} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "image": {
      const url = String(props.url ?? "");
      return (
        <figure className="my-2">
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={String(props.caption ?? "")}
              className="max-w-full rounded-md"
              referrerPolicy={FILE_URL.test(url) ? undefined : "no-referrer"}
            />
          )}
          {props.caption ? (
            <figcaption className="text-xs text-muted-foreground">
              {String(props.caption)}
            </figcaption>
          ) : null}
        </figure>
      );
    }
    case "file":
      return (
        <p>
          <a href={String(props.url ?? "")} className="underline">
            📎 {String(props.name ?? props.caption ?? "Attachment")}
          </a>
        </p>
      );
    case "embed":
    case "bookmark": {
      const url = String(props.url ?? "");
      return url ? (
        <p>
          <a href={url} className="underline">
            {String(props.title ?? "") || url}
          </a>
        </p>
      ) : null;
    }
    case "pageLink": {
      const id = String(props.pageId ?? "");
      return (
        <p>
          <a href={ctx.pageHref(id)} className="underline">
            📄 {ctx.pageTitle(id) ?? String(props.title ?? "page")}
          </a>
        </p>
      );
    }
    case "tableOfContents":
      return null;
    case "syncedBlock": {
      const synced =
        ctx.syncedBlock?.(String(props.syncedBlockId ?? "")) ?? null;
      if (!synced) {
        return (
          <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Synced content unavailable
          </p>
        );
      }
      return (
        <div className="space-y-1">
          <Blocks blocks={synced.blocks} ctx={ctx} />
          <p className="text-xs text-muted-foreground">
            {synced.sourceTitle
              ? `Synced from: ${synced.sourceTitle}`
              : "Synced content"}
          </p>
        </div>
      );
    }
    case "bulletListItem":
    case "numberedListItem":
    case "toggleListItem":
      return (
        <li>
          {inline}
          {children}
        </li>
      );
    case "paragraph":
    default:
      return (
        <>
          <p className="min-h-[1em]">{inline}</p>
          {children}
        </>
      );
  }
}

/** Groups consecutive list items into ul/ol so lists render as lists. */
export function Blocks({
  blocks,
  ctx,
}: {
  blocks: EditorBlock[];
  ctx: RenderContext;
}) {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const type = blocks[i].type;
    if (
      type === "bulletListItem" ||
      type === "toggleListItem" ||
      type === "numberedListItem"
    ) {
      const items: EditorBlock[] = [];
      while (i < blocks.length && blocks[i].type === type)
        items.push(blocks[i++]);
      const List = type === "numberedListItem" ? "ol" : "ul";
      out.push(
        <List
          key={items[0].id}
          className={
            type === "numberedListItem" ? "list-decimal pl-6" : "list-disc pl-6"
          }
        >
          {items.map((b) => (
            <Block key={b.id} block={b} ctx={ctx} />
          ))}
        </List>,
      );
    } else {
      out.push(<Block key={blocks[i].id} block={blocks[i]} ctx={ctx} />);
      i++;
    }
  }
  return <div className="space-y-2">{out}</div>;
}
