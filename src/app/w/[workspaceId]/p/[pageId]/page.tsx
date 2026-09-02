import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildDocument } from "@/lib/blocks";
import { cursorColourFor } from "@/lib/collab";
import { PageHeader } from "@/components/page/page-header";
import { PageMenu } from "@/components/page/page-menu";
import { PageCover } from "@/components/page/page-cover";
import { PageEditorLoader } from "@/components/page/page-editor-loader";
import { CommentsPanel } from "@/components/page/comments-panel";
import { BacklinksPanel } from "@/components/page/backlinks-panel";
import { TemplateUpdateBanner } from "@/components/page/template-update-banner";

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
      "id, workspace_id, parent_page_id, title, icon, cover_url, is_private, full_width, small_text, created_by, updated_at, deleted_at, template_id, template_version",
    )
    .eq("id", pageId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!page || page.deleted_at) notFound();

  const [
    { data: membership },
    { data: blockRows },
    { data: workspacePages },
    { data: memberRows },
    { count: uploadCount },
    { data: storedStateBase64 },
    { data: share },
    { data: commentRows },
    { data: linkRows },
    { data: platformOwner },
  ] = await Promise.all([
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
    // For the page-link block's picker.
    supabase
      .from("pages")
      .select("id, title, icon")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null),
    // For the "@" mention menu.
    supabase
      .from("workspace_members")
      .select("user_id, users (display_name)")
      .eq("workspace_id", workspaceId),
    // Drives the first-five-uploads confirmation gate.
    supabase
      .from("files")
      .select("id", { count: "exact", head: true })
      .eq("uploader_id", user.id)
      .is("deleted_at", null),
    // Durable Yjs state for seeding the collaboration room.
    supabase.rpc("load_page_document", { p_page_id: pageId }),
    // Public link state (editors only can read it via RLS).
    supabase
      .from("page_shares")
      .select("public_token, public_enabled")
      .eq("page_id", pageId)
      .maybeSingle(),
    // Page-level discussion thread.
    supabase
      .from("comments")
      .select("id, author_id, body, resolved, created_at, users (display_name)")
      .eq("page_id", pageId)
      .order("created_at", { ascending: true }),
    // Backlinks: pages that link to or mention this one.
    supabase
      .from("page_links")
      .select("source_page_id")
      .eq("target_page_id", pageId),
    // Platform owner may curate templates into the gallery.
    supabase
      .from("platform_owners")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    // Recently-viewed tracking; failure is harmless so no error handling.
    supabase.from("recent_pages").upsert({
      user_id: user.id,
      page_id: pageId,
      viewed_at: new Date().toISOString(),
    }),
  ]);
  const isOwner = membership?.role === "owner";
  const canEdit = isOwner || membership?.role === "editor";
  const canEditThisPage =
    canEdit && (!page.is_private || page.created_by === user.id);
  const initialContent = buildDocument(blockRows ?? []);
  const linkablePages = (workspacePages ?? []).filter((p) => p.id !== pageId);
  const members = (memberRows ?? []).map((m) => ({
    id: m.user_id,
    displayName: m.users?.display_name ?? "Unknown",
  }));
  // Collaboration switches on when the Liveblocks secret is configured;
  // otherwise the editor runs local-only (feature-flag by configuration).
  const collab = process.env.LIVEBLOCKS_SECRET_KEY
    ? {
        userName: members.find((m) => m.id === user.id)?.displayName ?? "You",
        userColour: cursorColourFor(user.id),
        storedStateBase64: storedStateBase64 ?? null,
      }
    : null;

  const comments = (commentRows ?? []).map((c) => ({
    id: c.id,
    authorId: c.author_id,
    authorName: c.users?.display_name ?? "Unknown",
    text: (c.body as { text?: string })?.text ?? "",
    resolved: c.resolved,
    createdAt: c.created_at,
  }));

  // Template provenance: is there a newer version than this page came from?
  let templateUpdate: {
    templateId: string;
    templateName: string;
    latestVersion: number;
    changes: { version: number; changelog: string }[];
  } | null = null;
  if (page.template_id && page.template_version !== null) {
    const { data: template } = await supabase
      .from("templates")
      .select(
        "id, name, template_versions!templates_current_version_fkey(version)",
      )
      .eq("id", page.template_id)
      .maybeSingle();
    const latest = template?.template_versions?.version ?? null;
    if (template && latest !== null && latest > page.template_version) {
      const { data: newer } = await supabase
        .from("template_versions")
        .select("version, changelog")
        .eq("template_id", template.id)
        .gt("version", page.template_version)
        .order("version", { ascending: true });
      templateUpdate = {
        templateId: template.id,
        templateName: template.name,
        latestVersion: latest,
        changes: newer ?? [],
      };
    }
  }

  const sourceIds = (linkRows ?? []).map((l) => l.source_page_id);
  const { data: backlinkPages } = sourceIds.length
    ? await supabase
        .from("pages")
        .select("id, title, icon")
        .in("id", sourceIds)
        .is("deleted_at", null)
    : { data: [] };

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
      <div className="mb-4 flex items-center justify-between gap-2">
        <nav className="min-w-0 text-sm text-muted-foreground">
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
        <PageMenu
          pageId={page.id}
          workspaceId={workspaceId}
          fullWidth={page.full_width}
          smallText={page.small_text}
          canEdit={canEditThisPage}
          isPlatformOwner={Boolean(platformOwner)}
          share={
            canEditThisPage
              ? {
                  enabled: share?.public_enabled ?? false,
                  token: share?.public_enabled ? share.public_token : null,
                }
              : null
          }
        />
      </div>

      {templateUpdate && canEditThisPage && (
        <TemplateUpdateBanner
          workspaceId={workspaceId}
          pageId={page.id}
          parentPageId={page.parent_page_id}
          templateId={templateUpdate.templateId}
          templateName={templateUpdate.templateName}
          currentVersion={page.template_version ?? 0}
          latestVersion={templateUpdate.latestVersion}
          changes={templateUpdate.changes}
        />
      )}

      <PageCover
        pageId={page.id}
        cover={page.cover_url}
        canEdit={canEditThisPage}
      />

      <PageHeader
        pageId={page.id}
        initialTitle={page.title}
        initialIcon={page.icon}
        isPrivate={page.is_private}
        canEdit={canEditThisPage}
      />

      <div className="mt-6">
        <PageEditorLoader
          key={page.id}
          pageId={page.id}
          workspaceId={workspaceId}
          linkablePages={linkablePages}
          members={members}
          initialContent={initialContent}
          editable={canEditThisPage}
          smallText={page.small_text}
          initialUploadCount={uploadCount ?? 0}
          collab={collab}
        />
      </div>

      <BacklinksPanel
        workspaceId={workspaceId}
        backlinks={backlinkPages ?? []}
      />

      <CommentsPanel
        workspaceId={workspaceId}
        pageId={page.id}
        comments={comments}
        currentUserId={user.id}
        canComment={canEditThisPage}
        isOwner={isOwner}
      />
    </main>
  );
}
