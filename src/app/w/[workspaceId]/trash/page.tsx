import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { purgePage, restorePage } from "@/app/actions/trash";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, PageHeading } from "@/components/ui/page-shell";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

const TRASH_DAYS = 30;

/**
 * Trash (brief §7): soft-deleted pages stay here for 30 days, then the
 * nightly purge removes them and their files for good.
 */
export default async function TrashPage({
  params,
}: PageProps<"/w/[workspaceId]/trash">) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: membership }, { data: pages }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("pages")
      .select("id, parent_page_id, title, icon, deleted_at")
      .eq("workspace_id", workspaceId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);
  if (!membership) notFound();
  const canEdit = membership.role === "owner" || membership.role === "editor";

  const trashed = pages ?? [];
  const trashedIds = new Set(trashed.map((p) => p.id));
  // Show the roots of trashed subtrees; descendants restore or purge with them.
  const roots = trashed.filter(
    (p) => !p.parent_page_id || !trashedIds.has(p.parent_page_id),
  );

  return (
    <PageShell className="gap-6">
      <PageHeading title="Trash">
        Deleted pages stay here for {TRASH_DAYS} days, then are removed
        permanently along with their files.
      </PageHeading>

      {roots.length === 0 ? (
        <EmptyState>The trash is empty.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {roots.map((page) => {
            const title = page.title || "Untitled";
            const purgeOn = new Date(
              new Date(page.deleted_at!).getTime() + TRASH_DAYS * 86_400_000,
            ).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            return (
              <li
                key={page.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="min-w-0 space-y-0.5">
                  <span className="block truncate">
                    {page.icon ? `${page.icon} ` : ""}
                    {title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Removed permanently on {purgeOn}
                  </span>
                </span>
                {canEdit && (
                  <span className="flex gap-2">
                    <form action={restorePage}>
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspaceId}
                      />
                      <input type="hidden" name="pageId" value={page.id} />
                      <SubmitButton
                        size="sm"
                        variant="secondary"
                        pendingLabel="Restoring…"
                      >
                        Restore
                      </SubmitButton>
                    </form>
                    <form action={purgePage}>
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspaceId}
                      />
                      <input type="hidden" name="pageId" value={page.id} />
                      <ConfirmButton
                        size="sm"
                        title={`Delete “${title}” permanently?`}
                        description="The page, its sub-pages and their files are removed for good. This cannot be undone."
                        confirmLabel="Delete permanently"
                      >
                        Delete permanently
                      </ConfirmButton>
                    </form>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
