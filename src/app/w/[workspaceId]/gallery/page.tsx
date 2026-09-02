import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_CATEGORIES } from "@/lib/template-categories";

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

  const [{ data: membership }, { data: templates }] = await Promise.all([
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
  ]);
  if (!membership) notFound();

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
    <main className="mx-auto w-full max-w-3xl space-y-8 p-6 md:p-12">
      <div>
        <h1 className="text-2xl font-semibold">Template gallery</h1>
        <p className="text-sm text-muted-foreground">
          Start a page or a whole tree from a template. Your own copies are
          yours — template updates never change them.
        </p>
      </div>

      {(templates ?? []).length === 0 && (
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          No templates yet. Open any page → ⋯ → <em>Save as template</em> to
          create the first one.
        </p>
      )}

      {categories.map((category) => {
        const items = (templates ?? []).filter((t) => t.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {category}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/w/${workspaceId}/gallery/${t.id}`}
                    className="block h-full rounded-lg border p-4 hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium">{t.name}</h3>
                      <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t.kind}
                      </span>
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
    </main>
  );
}
