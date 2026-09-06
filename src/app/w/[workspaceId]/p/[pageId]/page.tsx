import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildDocument } from "@/lib/blocks";
import { cursorColourFor } from "@/lib/collab";
import { normalizeProperties } from "@/lib/page-properties";
import { comparePositions } from "@/lib/position";
import { PageHeader } from "@/components/page/page-header";
import { PageMenu } from "@/components/page/page-menu";
import { AddCoverButton, PageCover } from "@/components/page/page-cover";
import { PageDetails } from "@/components/page/page-details";
import { PageTopBar } from "@/components/page/page-top-bar";
import { SubPages } from "@/components/page/sub-pages";
import { PageEditorLoader } from "@/components/page/page-editor-loader";
import { CommentsPanel } from "@/components/page/comments-panel";
import { BacklinksPanel } from "@/components/page/backlinks-panel";
import { TemplateUpdateBanner } from "@/components/page/template-update-banner";
import { SaveStatusProvider } from "@/components/page/save-status";
import { PageShell } from "@/components/ui/page-shell";

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
      "id, workspace_id, parent_page_id, title, icon, cover_url, description, properties, is_private, full_width, small_text, created_by, created_at, updated_by, updated_at, deleted_at, template_id, template_version",
    )
    .eq("id", pageId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!page || page.deleted_at) notFound();

  const [
    { data: workspace },
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
    { data: favourite },
  ] = await Promise.all([
    supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .maybeSingle(),
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
    // For the page-link picker, the breadcrumb trail, the sub-pages list
    // and the "Type" options offered on this page.
    supabase
      .from("pages")
      .select(
        "id, title, icon, parent_page_id, position, created_by, created_at, updated_at, properties",
      )
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null),
    // For the "@" mention menu, the People property and the edited-by names.
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
    // Is this page one of the viewer's favourites?
    supabase
      .from("favourites")
      .select("page_id")
      .eq("user_id", user.id)
      .eq("page_id", pageId)
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
  const allPages = workspacePages ?? [];
  const linkablePages = allPages
    .filter((p) => p.id !== pageId)
    .map(({ id, title, icon }) => ({ id, title, icon }));
  const members = (memberRows ?? []).map((m) => ({
    id: m.user_id,
    displayName: m.users?.display_name ?? "Unknown",
  }));
  const nameOf = (id: string | null) =>
    id === user.id
      ? "You"
      : (members.find((m) => m.id === id)?.displayName ?? "A former member");
  const people = members.map((m) => ({ id: m.id, name: m.displayName }));
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

  const sourceIds = new Set((linkRows ?? []).map((l) => l.source_page_id));
  const backlinkPages = allPages
    .filter((p) => sourceIds.has(p.id))
    .map(({ id, title, icon }) => ({ id, title, icon }));

  // Breadcrumb trail from the page's ancestors, resolved from the pages
  // already loaded for this workspace (no extra round-trips).
  const pageById = new Map(allPages.map((p) => [p.id, p]));
  const crumbs: { id: string; title: string; icon: string | null }[] = [];
  let parentId = page.parent_page_id;
  for (let i = 0; parentId && i < 10; i++) {
    const parent = pageById.get(parentId);
    if (!parent) break;
    crumbs.unshift({ id: parent.id, title: parent.title, icon: parent.icon });
    parentId = parent.parent_page_id;
  }

  // Page details, and the same properties on every other page in the
  // workspace: "Type" values already in use are offered as options, and
  // sub-pages show their own type, people and date.
  const properties = normalizeProperties(page.properties);
  const propertiesOf = new Map(
    allPages.map((p) => [p.id, normalizeProperties(p.properties)]),
  );
  const selectValues = new Set<string>();
  for (const props of propertiesOf.values()) {
    for (const row of props.rows) {
      if (row.type === "select" && row.value) selectValues.add(row.value);
    }
  }
  const subPages = allPages
    .filter((p) => p.parent_page_id === pageId)
    .sort((a, b) => comparePositions(a.position, b.position))
    .map((p) => {
      const props = propertiesOf.get(p.id);
      const select = props?.rows.find((r) => r.type === "select" && r.value);
      const date = props?.rows.find((r) => r.type === "date" && r.value);
      const peopleRow = props?.rows.find((r) => r.type === "people");
      const ids = peopleRow?.type === "people" ? peopleRow.value : [];
      return {
        id: p.id,
        title: p.title,
        icon: p.icon,
        createdBy: p.created_by,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        type: select?.type === "select" ? select.value : null,
        date: date?.type === "date" ? date.value : null,
        people: ids
          .map((id) => people.find((m) => m.id === id))
          .filter((m) => m !== undefined),
      };
    });

  const menu = (
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
  );

  return (
    <SaveStatusProvider>
      <PageShell
        width={page.full_width ? "full" : "wide"}
        className="min-h-screen gap-6 pt-0 md:pt-0"
      >
        <PageTopBar
          workspaceId={workspaceId}
          workspaceName={workspace?.name ?? "Workspace"}
          pageId={page.id}
          title={page.title}
          icon={page.icon}
          crumbs={crumbs}
          edited={{
            at: page.updated_at,
            name: nameOf(page.updated_by),
            isYou: page.updated_by === user.id,
          }}
          created={{ at: page.created_at, name: nameOf(page.created_by) }}
          commentCount={comments.filter((c) => !c.resolved).length}
          isFavourite={Boolean(favourite)}
          canEdit={canEditThisPage}
          collab={
            collab
              ? {
                  storedStateBase64: collab.storedStateBase64,
                  userName: collab.userName,
                }
              : null
          }
          actions={menu}
        />

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

        <div className="space-y-4">
          {page.cover_url && (
            <PageCover
              pageId={page.id}
              cover={page.cover_url}
              canEdit={canEditThisPage}
            />
          )}
          <PageHeader
            pageId={page.id}
            initialTitle={page.title}
            initialIcon={page.icon}
            initialDescription={page.description}
            isPrivate={page.is_private}
            canEdit={canEditThisPage}
            addCover={
              !page.cover_url && canEditThisPage ? (
                <AddCoverButton pageId={page.id} />
              ) : undefined
            }
          />
          <PageDetails
            pageId={page.id}
            initial={properties}
            created={{
              id: page.created_by,
              name: nameOf(page.created_by),
              at: page.created_at,
            }}
            edited={{
              id: page.updated_by,
              name: nameOf(page.updated_by),
              at: page.updated_at,
            }}
            members={people}
            siblingSelectValues={[...selectValues].sort()}
            canEdit={canEditThisPage}
          />
        </div>

        {(subPages.length > 0 || canEditThisPage) && subPages.length > 0 && (
          <SubPages
            workspaceId={workspaceId}
            pageId={page.id}
            pages={subPages}
            currentUserId={user.id}
            canEdit={canEditThisPage}
          />
        )}

        <PageEditorLoader
          key={page.id}
          pageId={page.id}
          workspaceId={workspaceId}
          linkablePages={linkablePages}
          members={members}
          initialContent={initialContent}
          editable={canEditThisPage}
          isPrivate={page.is_private}
          smallText={page.small_text}
          initialUploadCount={uploadCount ?? 0}
          collab={collab}
        />

        <BacklinksPanel workspaceId={workspaceId} backlinks={backlinkPages} />

        <div id="comments">
          <CommentsPanel
            workspaceId={workspaceId}
            pageId={page.id}
            comments={comments}
            currentUserId={user.id}
            canComment={canEditThisPage}
            isOwner={isOwner}
          />
        </div>
      </PageShell>
    </SaveStatusProvider>
  );
}
