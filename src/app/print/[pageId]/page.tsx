import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildDocument } from "@/lib/blocks";
import { planExport } from "@/lib/export";
import { descendantIds } from "@/lib/tree";
import { Blocks } from "@/components/render/blocks-renderer";
import { PrintTrigger } from "@/app/print/[pageId]/print-trigger";

export const dynamic = "force-dynamic";

/**
 * PDF export (brief §5) via the browser's print engine: a clean,
 * print-styled rendering of a page or its whole tree that opens the print
 * dialog on load. Consistent output everywhere, no server-side browser.
 */
export default async function PrintPage({
  params,
  searchParams,
}: PageProps<"/print/[pageId]">) {
  const { pageId } = await params;
  const tree = (await searchParams).tree === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: root } = await supabase
    .from("pages")
    .select("id, workspace_id, title")
    .eq("id", pageId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!root) notFound();

  const { data: allPages } = await supabase
    .from("pages")
    .select("id, parent_page_id, position, title, icon, is_private, created_by")
    .eq("workspace_id", root.workspace_id)
    .is("deleted_at", null);
  const pages = allPages ?? [];
  const include = tree
    ? new Set([root.id, ...descendantIds(pages, root.id)])
    : new Set([root.id]);
  const selected = pages
    .filter((p) => include.has(p.id))
    .map((p) => ({
      ...p,
      parent_page_id: p.id === root.id ? null : p.parent_page_id,
    }));
  const entries = planExport(selected, root.id);

  const { data: blockRows } = await supabase
    .from("blocks")
    .select("id, page_id, parent_block_id, type, position, content")
    .in("page_id", [...include]);
  const byPage = new Map<string, NonNullable<typeof blockRows>>();
  for (const row of blockRows ?? []) {
    const list = byPage.get(row.page_id) ?? [];
    list.push(row);
    byPage.set(row.page_id, list);
  }
  const titleById = new Map(pages.map((p) => [p.id, p.title]));

  return (
    <main className="mx-auto max-w-3xl p-8 print:p-0">
      <PrintTrigger />
      <p className="mb-6 text-xs text-muted-foreground print:hidden">
        Use your browser&apos;s print dialog to save as PDF. This view is
        read-only.
      </p>
      {entries.map((entry, index) => (
        <article
          key={entry.page.id}
          className={index > 0 ? "break-before-page pt-8" : ""}
        >
          <h1 className="mb-4 text-3xl font-bold">
            {entry.page.icon ? `${entry.page.icon} ` : ""}
            {entry.page.title || "Untitled"}
          </h1>
          <Blocks
            blocks={buildDocument(byPage.get(entry.page.id) ?? [])}
            ctx={{
              pageHref: (id) => `/w/${root.workspace_id}/p/${id}`,
              pageTitle: (id) => titleById.get(id) ?? null,
            }}
          />
        </article>
      ))}
      <p className="mt-10 text-xs text-muted-foreground">
        Exported from WorkspaceICU · not a clinical record
      </p>
    </main>
  );
}
