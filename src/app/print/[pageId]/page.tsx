import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildDocument } from "@/lib/blocks";
import { planExport } from "@/lib/export";
import { descendantIds } from "@/lib/tree";
import { Blocks } from "@/components/render/blocks-renderer";
import {
  loadMarkupExport,
  unresolvedSuggestionCounts,
} from "@/lib/markup-export";
import { loadSyncedForPages, type SyncedLookup } from "@/lib/synced-export";
import { syncedBlockIdsIn } from "@/lib/synced";
import { PrintTrigger } from "@/app/print/[pageId]/print-trigger";

export const dynamic = "force-dynamic";

/**
 * PDF export (brief §5) via the browser's print engine: a clean,
 * print-styled rendering of a page or its whole tree that opens the print
 * dialog on load. Consistent output everywhere, no server-side browser.
 * Clean state by default (Appendix A §2.4); `?markup=1` keeps suggestion
 * markup, and either way pages with suggestions still waiting are named
 * in a notice that is not printed.
 */
export default async function PrintPage({
  params,
  searchParams,
}: PageProps<"/print/[pageId]">) {
  const { pageId } = await params;
  const query = await searchParams;
  const tree = query.tree === "1";
  const markup = query.markup === "1";

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
    .select(
      "id, parent_page_id, position, title, icon, is_private, created_by, description",
    )
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
  const cleanSynced = await loadSyncedForPages(supabase, [...include]);
  const cleanDocuments = new Map(
    entries.map((e) => [e.page.id, buildDocument(byPage.get(e.page.id) ?? [])]),
  );
  const syncedIds = new Set<string>();
  for (const doc of cleanDocuments.values()) {
    for (const id of syncedBlockIdsIn(doc)) syncedIds.add(id);
  }
  const marked = markup
    ? await loadMarkupExport(supabase, [...include], [...syncedIds])
    : null;
  const syncedBlock: SyncedLookup = (id) => {
    const clean = cleanSynced(id);
    if (!clean) return null;
    const withMarkup = marked?.syncedBlocks.get(id);
    return withMarkup ? { ...clean, blocks: withMarkup } : clean;
  };
  const counts = await unresolvedSuggestionCounts(supabase, [...include]);
  const waiting = entries.filter((e) => (counts.get(e.page.id) ?? 0) > 0);
  const waitingTotal = waiting.reduce(
    (n, e) => n + (counts.get(e.page.id) ?? 0),
    0,
  );

  return (
    <main id="main" className="mx-auto max-w-3xl p-6 md:p-12 print:p-0">
      <PrintTrigger />
      <p className="mb-2 text-xs text-muted-foreground print:hidden">
        Use your browser&apos;s print dialog to save as PDF. This view is
        read-only.
        {markup
          ? " Suggestion markup is shown: insertions underlined in green, deletions struck through in red."
          : ""}
      </p>
      {waiting.length > 0 && (
        <div
          role="status"
          className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 print:hidden"
        >
          <p className="font-medium">
            {waitingTotal} suggestion{waitingTotal === 1 ? "" : "s"} still
            waiting on{" "}
            {waiting.length === 1
              ? "this page"
              : `${waiting.length} of the included pages`}
            .
          </p>
          <p className="mt-1">
            {markup
              ? "They are shown as markup here. The clean export leaves suggested insertions out and keeps suggested deletions as the author's text."
              : "This is the clean state: suggested insertions are left out and suggested deletions remain as the author's text. Resolve them in the app before using this as a record."}
          </p>
          {waiting.length > 1 && (
            <ul className="mt-1 list-disc pl-5">
              {waiting.map((e) => (
                <li key={e.page.id}>
                  {e.page.title || "Untitled"}: {counts.get(e.page.id)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {entries.map((entry, index) => (
        <article
          key={entry.page.id}
          className={index > 0 ? "break-before-page pt-8" : ""}
        >
          <h1 className="mb-4 text-3xl font-bold">
            {entry.page.icon ? `${entry.page.icon} ` : ""}
            {entry.page.title || "Untitled"}
          </h1>
          {entry.page.description && (
            <p className="mb-4 text-base text-muted-foreground">
              {entry.page.description}
            </p>
          )}
          <Blocks
            blocks={
              marked?.pageBlocks.get(entry.page.id) ??
              cleanDocuments.get(entry.page.id) ??
              []
            }
            ctx={{
              pageHref: (id) => `/w/${root.workspace_id}/p/${id}`,
              pageTitle: (id) => titleById.get(id) ?? null,
              syncedBlock,
              suggester: marked?.suggester,
            }}
          />
        </article>
      ))}
      <p className="mt-10 text-xs text-muted-foreground">
        Exported from WorkspaceICU · not a clinical record
        {markup ? " · with suggestion markup" : ""}
      </p>
    </main>
  );
}
