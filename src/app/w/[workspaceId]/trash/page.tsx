import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { purgePage, restorePage } from "@/app/actions/trash";
import { Button } from "@/components/ui/button";

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
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6 md:p-12">
      <div>
        <h1 className="text-2xl font-semibold">Trash</h1>
        <p className="text-sm text-muted-foreground">
          Deleted pages stay here for {TRASH_DAYS} days, then are removed
          permanently along with their files.
        </p>
      </div>

      {roots.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          The trash is empty.
        </p>
      ) : (
        <ul className="space-y-2">
          {roots.map((page) => {
            const purgeOn = new Date(
              new Date(page.deleted_at!).getTime() + TRASH_DAYS * 86_400_000,
            );
            return (
              <li
                key={page.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  {page.icon ? `${page.icon} ` : ""}
                  {page.title || "Untitled"}
                  <span className="ml-2 text-xs text-muted-foreground">
                    Removed permanently on{" "}
                    {purgeOn.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </span>
                {canEdit && (
                  <span className="flex gap-1">
                    <form action={restorePage}>
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspaceId}
                      />
                      <input type="hidden" name="pageId" value={page.id} />
                      <Button type="submit" size="sm" variant="secondary">
                        Restore
                      </Button>
                    </form>
                    <form action={purgePage}>
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspaceId}
                      />
                      <input type="hidden" name="pageId" value={page.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                      >
                        Delete permanently
                      </Button>
                    </form>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
