import {
  hasValue,
  type PageProperties,
  type PagePropertyRow,
} from "@/lib/page-properties";
import type { RelationLinks, ReverseGroup } from "@/lib/relations";
import { formatPropertyDate } from "@/lib/time";

/**
 * A page's properties as an export sees them (Appendix B §4.6, as
 * amended: every type renders, as one labelled block under the
 * description). Pure: the Markdown archive and the print view both build
 * from these lines. A relation renders its pages in stored order, a
 * trashed page as "Title (in trash)", and the reverse side follows under
 * its reverse label. Only rows with something to say are listed.
 */

export interface PropertyPart {
  text: string;
  /** A link target when the export can point at the page; null otherwise. */
  href: string | null;
  /** Rendered subdued: a page in the trash. */
  muted?: boolean;
}

export interface PropertyLine {
  label: string;
  parts: PropertyPart[];
}

export interface PropertyExportContext {
  /** Display name for a member id; null when unknown. */
  memberName: (id: string) => string | null;
  /** Where a page can be reached from this export; null when it cannot. */
  pageHref: (id: string) => string | null;
  /** Forward links of this page, by relation row id (visible ones only). */
  links: RelationLinks;
  /** The reverse side of this page, grouped by label. */
  reverse: ReverseGroup[];
}

function plain(text: string): PropertyPart[] {
  return [{ text, href: null }];
}

function pageParts(
  pages: { id: string; title: string; trashed: boolean }[],
  ctx: PropertyExportContext,
): PropertyPart[] {
  return pages.map((page) => {
    const title = page.title || "Untitled";
    return page.trashed
      ? { text: `${title} (in trash)`, href: null, muted: true }
      : { text: title, href: ctx.pageHref(page.id) };
  });
}

function rowLine(
  row: PagePropertyRow,
  ctx: PropertyExportContext,
): PropertyLine | null {
  switch (row.type) {
    case "people": {
      if (!hasValue(row)) return null;
      const names = row.value.map(
        (id) => ctx.memberName(id) ?? "A former member",
      );
      return { label: row.label, parts: plain(names.join(", ")) };
    }
    case "date":
      return row.value
        ? { label: row.label, parts: plain(formatPropertyDate(row.value)) }
        : null;
    case "select":
    case "text":
      return row.value ? { label: row.label, parts: plain(row.value) } : null;
    case "link":
      return row.value
        ? { label: row.label, parts: [{ text: row.value, href: row.value }] }
        : null;
    case "relation": {
      const links = ctx.links[row.id] ?? [];
      if (links.length === 0) return null;
      return {
        label: row.label,
        parts: pageParts(
          links.map((l) => l.page),
          ctx,
        ),
      };
    }
  }
}

export function propertyLines(
  properties: PageProperties,
  ctx: PropertyExportContext,
): PropertyLine[] {
  const lines: PropertyLine[] = [];
  for (const row of properties.rows) {
    const line = rowLine(row, ctx);
    if (line) lines.push(line);
  }
  for (const group of ctx.reverse) {
    if (group.links.length === 0) continue;
    lines.push({
      label: group.reverseLabel,
      parts: pageParts(
        group.links.map((l) => l.page),
        ctx,
      ),
    });
  }
  return lines;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]<>])/g, "\\$1");
}

/**
 * `**Label:** Title A, Title B` per line, hard-broken, with a blank line
 * after the block; empty when there is nothing to show.
 */
export function propertyLinesToMarkdown(lines: PropertyLine[]): string {
  if (lines.length === 0) return "";
  const rendered = lines.map((line) => {
    const values = line.parts
      .map((part) => {
        const text = part.muted
          ? `_${escapeMarkdown(part.text)}_`
          : escapeMarkdown(part.text);
        return part.href ? `[${text}](${part.href})` : text;
      })
      .join(", ");
    return `**${escapeMarkdown(line.label)}:** ${values}`;
  });
  return `${rendered.join("  \n")}\n\n`;
}
