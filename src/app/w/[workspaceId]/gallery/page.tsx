import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_CATEGORIES } from "@/lib/template-categories";
import { installPack, listPacks } from "@/app/actions/packs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  PageShell,
  PageHeading,
  SectionHeading,
} from "@/components/ui/page-shell";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

/**
 * The gallery (brief §3 layer 2): curated platform templates plus this
 * workspace's own, by category. RLS decides what is visible.
 */
export default async function GalleryPage({
  params,
}: PageProps<"/w/[workspaceId]/gallery">) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: membership }, { data: templates }, { data: platformOwner }] =
    await Promise.all([
      supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("templates")
        .select(
          "id, name, purpose, category, audience, kind, owner_scope, is_published, workspace_id, current_version_id",
        )
        .or(`owner_scope.eq.platform,workspace_id.eq.${workspaceId}`)
        .not("current_version_id", "is", null)
        .order("name", { ascending: true }),
      supabase
        .from("platform_owners")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
  if (!membership) notFound();
  const packs = platformOwner ? await listPacks() : [];

  const categories = [
    ...TEMPLATE_CATEGORIES,
    ...new Set(
      (templates ?? [])
        .map((t) => t.category)
        .filter(
          (c) =>
            !TEMPLATE_CATEGORIES.includes(
              c as (typeof TEMPLATE_CATEGORIES)[number],
            ),
        ),
    ),
  ];

  return (
    <PageShell width="wide">
      <PageHeading title="Template gallery">
        Start a page or a whole tree from a template. Your own copies are yours
        — template updates never change them.
      </PageHeading>

      {platformOwner && packs.some((p) => !p.installed) && (
        <section className="space-y-3 rounded-md border p-4">
          <SectionHeading>
            Platform packs <Badge variant="outline">Owner only</Badge>
          </SectionHeading>
          <p className="text-sm text-muted-foreground">
            Bundled content packs authored in the repository. Installing
            publishes them to the gallery for everyone; from then on edit them
            in the app and republish.
          </p>
          <ul className="space-y-2">
            {packs
              .filter((p) => !p.installed)
              .map((p) => (
                <li
                  key={p.name}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    <strong>{p.name}</strong>
                    <span className="ml-2 text-muted-foreground">
                      {p.purpose}
                    </span>
                  </span>
                  <form action={installPack}>
                    <input type="hidden" name="name" value={p.name} />
                    <input
                      type="hidden"
                      name="workspaceId"
                      value={workspaceId}
                    />
                    <SubmitButton
                      size="sm"
                      variant="secondary"
                      pendingLabel="Installing…"
                    >
                      Install
                    </SubmitButton>
                  </form>
                </li>
              ))}
          </ul>
        </section>
      )}

      {(templates ?? []).length === 0 && (
        <EmptyState title="No templates yet">
          Open any page, choose <em>Page options</em>, then{" "}
          <em>Save as template</em> to create the first one.
        </EmptyState>
      )}

      {categories.map((category) => {
        const items = (templates ?? []).filter((t) => t.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="space-y-3">
            <SectionHeading>{category}</SectionHeading>
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/w/${workspaceId}/gallery/${t.id}`}
                    className="block h-full rounded-md border p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium">{t.name}</h3>
                      <Badge variant="muted" className="shrink-0 capitalize">
                        {t.kind}
                      </Badge>
                    </div>
                    {t.purpose && <p className="mt-1 text-sm">{t.purpose}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t.audience ? `For ${t.audience} · ` : ""}
                      {t.owner_scope === "platform"
                        ? t.is_published
                          ? "Curated"
                          : "Unpublished (owner only)"
                        : "This workspace"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </PageShell>
  );
}
