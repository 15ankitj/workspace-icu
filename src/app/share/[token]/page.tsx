import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildDocument, type BlockRowFromDb } from "@/lib/blocks";
import { coverGradient } from "@/lib/cover";
import { PageEditorLoader } from "@/components/page/page-editor-loader";
import { Notice } from "@/components/ui/notice";
import { PageShell } from "@/components/ui/page-shell";

export const dynamic = "force-dynamic";

interface PublicPage {
  page: {
    id: string;
    title: string;
    icon: string | null;
    cover_url: string | null;
    full_width: boolean;
    small_text: boolean;
    description?: string;
    updated_at: string;
  };
  blocks: BlockRowFromDb[];
}

/**
 * Public read-only view of a shared page (brief §4). No sign-in: the
 * database function resolves the token itself and returns only the page
 * and its blocks. Attachments still require sign-in.
 */
export default async function SharedPage({
  params,
}: PageProps<"/share/[token]">) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_page", { p_token: token });
  if (!data) notFound();

  const { page, blocks } = data as unknown as PublicPage;
  const gradient = page.cover_url ? coverGradient(page.cover_url) : null;

  return (
    <PageShell
      width={page.full_width ? "full" : "wide"}
      className="min-h-screen gap-6"
    >
      <Notice
        title="Shared read-only from WorkspaceICU"
        actions={
          <Link
            href="/sign-in"
            className="text-sm underline underline-offset-4"
          >
            Sign in to WorkspaceICU
          </Link>
        }
      >
        <p>
          Not a clinical record. Last updated{" "}
          {new Date(page.updated_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          .
        </p>
      </Notice>

      <div className="space-y-4">
        {page.cover_url && (
          <div className="h-40 w-full overflow-hidden rounded-md md:h-52">
            {gradient ? (
              <div className="h-full w-full" style={{ background: gradient }} />
            ) : (
              // Arbitrary remote hosts; next/image needs a domain allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={page.cover_url}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        )}

        <header className="space-y-2">
          {page.icon && (
            <div className="text-4xl" aria-hidden>
              {page.icon}
            </div>
          )}
          <h1 className="text-4xl font-bold tracking-tight">
            {page.title || "Untitled"}
          </h1>
          {page.description && (
            <p className="text-base text-muted-foreground">
              {page.description}
            </p>
          )}
        </header>
      </div>

      <PageEditorLoader
        pageId={page.id}
        workspaceId=""
        linkablePages={[]}
        members={[]}
        initialContent={buildDocument(blocks)}
        editable={false}
        smallText={page.small_text}
        initialUploadCount={0}
        collab={null}
      />
    </PageShell>
  );
}
