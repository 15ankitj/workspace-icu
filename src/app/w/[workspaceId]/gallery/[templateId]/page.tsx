import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buildDocument } from "@/lib/blocks";
import type { TemplateSnapshot } from "@/lib/templates";
import {
  deleteTemplate,
  republishTemplate,
  setTemplatePublished,
  startFromTemplate,
} from "@/app/actions/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell, SectionHeading } from "@/components/ui/page-shell";
import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/ui/submit-button";
import { PageEditorLoader } from "@/components/page/page-editor-loader";

export const dynamic = "force-dynamic";

/** Template detail: metadata, read-only preview, start, and management. */
export default async function TemplateDetail({
  params,
}: PageProps<"/w/[workspaceId]/gallery/[templateId]">) {
  const { workspaceId, templateId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [
    { data: membership },
    { data: template },
    { data: versions },
    { data: platformOwner },
  ] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("templates")
      .select(
        "id, name, purpose, description, category, audience, kind, owner_scope, workspace_id, source_page_id, current_version_id, is_published, created_by",
      )
      .eq("id", templateId)
      .maybeSingle(),
    supabase
      .from("template_versions")
      .select("id, version, changelog, created_at, snapshot")
      .eq("template_id", templateId)
      .order("version", { ascending: false }),
    supabase
      .from("platform_owners")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!membership || !template) notFound();

  const current = (versions ?? []).find(
    (v) => v.id === template.current_version_id,
  );
  const snapshot = current?.snapshot as unknown as TemplateSnapshot | undefined;
  const firstPage = snapshot?.pages[0];
  const isPlatformOwner = Boolean(platformOwner);
  const canManage =
    template.owner_scope === "platform"
      ? isPlatformOwner
      : template.created_by === user.id || membership.role === "owner";
  const canStart = membership.role === "owner" || membership.role === "editor";

  return (
    <PageShell width="wide" className="gap-6">
      <Button variant="ghost" size="sm" className="-ml-3 w-fit" asChild>
        <Link href={`/w/${workspaceId}/gallery`}>
          <ArrowLeft /> Gallery
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {template.name}
            </h1>
            <Badge variant="muted" className="capitalize">
              {template.kind}
            </Badge>
            {current && <Badge variant="outline">v{current.version}</Badge>}
          </div>
          {template.purpose && <p className="text-sm">{template.purpose}</p>}
          <p className="text-sm text-muted-foreground">
            {template.category}
            {template.audience ? ` · For ${template.audience}` : ""}
            {snapshot
              ? ` · ${snapshot.pages.length} page${snapshot.pages.length === 1 ? "" : "s"}`
              : ""}
          </p>
          {template.description && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {template.description}
            </p>
          )}
        </div>
        {canStart && current && (
          <form action={startFromTemplate}>
            <input type="hidden" name="templateId" value={template.id} />
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <SubmitButton pendingLabel="Creating…">
              Start with this template
            </SubmitButton>
          </form>
        )}
      </header>

      {firstPage && (
        <section className="space-y-2">
          <SectionHeading>Preview</SectionHeading>
          <div className="rounded-md border p-4">
            <p className="mb-2 text-lg font-semibold">
              {firstPage.icon ? `${firstPage.icon} ` : ""}
              {firstPage.title || "Untitled"}
            </p>
            <PageEditorLoader
              key={current?.id}
              pageId={`preview-${template.id}`}
              workspaceId={workspaceId}
              linkablePages={[]}
              members={[]}
              initialContent={buildDocument(firstPage.blocks)}
              editable={false}
              smallText={firstPage.small_text}
              initialUploadCount={0}
              collab={null}
            />
          </div>
          {snapshot && snapshot.pages.length > 1 && (
            <p className="text-sm text-muted-foreground">
              Also includes:{" "}
              {snapshot.pages
                .slice(1)
                .map((p) => p.title || "Untitled")
                .join(", ")}
            </p>
          )}
        </section>
      )}

      {(versions ?? []).length > 0 && (
        <section className="space-y-2">
          <SectionHeading>Versions</SectionHeading>
          <ul className="space-y-1 text-sm">
            {(versions ?? []).map((v) => (
              <li key={v.id}>
                <strong>v{v.version}</strong>{" "}
                <span className="text-muted-foreground">
                  {new Date(v.created_at).toLocaleDateString("en-GB")}
                </span>
                {v.changelog ? ` — ${v.changelog}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && (
        <>
          <Separator />
          <section className="space-y-3">
            <SectionHeading>Manage</SectionHeading>
            {template.source_page_id && (
              <form action={republishTemplate} className="flex flex-wrap gap-2">
                <input type="hidden" name="templateId" value={template.id} />
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <Label htmlFor="changelog" className="sr-only">
                  What changed in this version?
                </Label>
                <Input
                  id="changelog"
                  name="changelog"
                  placeholder="What changed in this version?"
                  className="min-w-0 flex-1"
                />
                <SubmitButton variant="secondary" pendingLabel="Publishing…">
                  Republish from source page
                </SubmitButton>
              </form>
            )}
            <div className="flex flex-wrap gap-2">
              {template.owner_scope === "platform" && (
                <form action={setTemplatePublished}>
                  <input type="hidden" name="templateId" value={template.id} />
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input
                    type="hidden"
                    name="published"
                    value={template.is_published ? "false" : "true"}
                  />
                  <SubmitButton variant="secondary">
                    {template.is_published
                      ? "Hide from gallery"
                      : "Publish to gallery"}
                  </SubmitButton>
                </form>
              )}
              <form action={deleteTemplate}>
                <input type="hidden" name="templateId" value={template.id} />
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <ConfirmButton
                  title={`Delete the template “${template.name}”?`}
                  description="It disappears from the gallery for everyone. Pages already created from it are not affected."
                  confirmLabel="Delete template"
                >
                  Delete template
                </ConfirmButton>
              </form>
            </div>
            <p className="text-sm text-muted-foreground">
              Existing copies are never affected by republishing, hiding or
              deleting a template.
            </p>
          </section>
        </>
      )}
    </PageShell>
  );
}
