import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildDocument } from "@/lib/blocks";
import { PageHeader } from "@/components/page/page-header";
import { PageEditorLoader } from "@/components/page/page-editor-loader";

export const dynamic = "force-dynamic";

export default async function PageView({
  params,
}: PageProps<"/w/[workspaceId]/p/[pageId]">) {
  const { workspaceId, pageId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: page } = await supabase
    .from("pages")
    .select(
      "id, workspace_id, parent_page_id, title, icon, is_private, full_width, created_by, updated_at, deleted_at",
    )
    .eq("id", pageId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!page || page.deleted_at) notFound();

  const [{ data: membership }, { data: blockRows }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("blocks")
      .select("id, parent_block_id, type, position, content")
      .eq("page_id", pageId),
    // Recently-viewed tracking; failure is harmless so no error handling.
    supabase.from("recent_pages").upsert({
      user_id: user.id,
      page_id: pageId,
      viewed_at: new Date().toISOString(),
    }),
  ]);
  const canEdit = membership?.role === "owner" || membership?.role === "editor";
  const initialContent = buildDocument(blockRows ?? []);

  // Breadcrumb trail from the page's ancestors.
  const crumbs: { id: string; title: string }[] = [];
  let parentId = page.parent_page_id;
  for (let i = 0; parentId && i < 10; i++) {
    const { data: parent } = await supabase
      .from("pages")
      .select("id, title, parent_page_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent) break;
    crumbs.unshift({ id: parent.id, title: parent.title || "Untitled" });
    parentId = parent.parent_page_id;
  }

  return (
    <main
      className={`mx-auto min-h-screen w-full p-6 md:p-12 ${
        page.full_width ? "" : "max-w-3xl"
      }`}
    >
      {crumbs.length > 0 && (
        <nav className="mb-4 text-sm text-muted-foreground">
          {crumbs.map((crumb) => (
            <span key={crumb.id}>
              <Link
                href={`/w/${workspaceId}/p/${crumb.id}`}
                className="hover:text-foreground"
              >
                {crumb.title}
              </Link>
              <span className="mx-1">/</span>
            </span>
          ))}
          <span className="text-foreground">{page.title || "Untitled"}</span>
        </nav>
      )}

      <PageHeader
        pageId={page.id}
        initialTitle={page.title}
        initialIcon={page.icon}
        isPrivate={page.is_private}
        canEdit={canEdit && (!page.is_private || page.created_by === user.id)}
      />

      <div className="mt-6">
        <PageEditorLoader
          pageId={page.id}
          initialContent={initialContent}
          editable={
            canEdit && (!page.is_private || page.created_by === user.id)
          }
        />
      </div>
    </main>
  );
}
