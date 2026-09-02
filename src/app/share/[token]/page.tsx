import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildDocument, type BlockRowFromDb } from "@/lib/blocks";
import { coverGradient } from "@/lib/cover";
import { PageEditorLoader } from "@/components/page/page-editor-loader";

export const dynamic = "force-dynamic";

interface PublicPage {
  page: {
    id: string;
    title: string;
    icon: string | null;
    cover_url: string | null;
    full_width: boolean;
    small_text: boolean;
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
    <main
      className={`mx-auto min-h-screen w-full p-6 md:p-12 ${
        page.full_width ? "" : "max-w-3xl"
      }`}
    >
      <p className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Shared read-only from WorkspaceICU. Not a clinical record.
      </p>

      {page.cover_url && (
        <div className="mb-6 h-40 w-full overflow-hidden rounded-lg md:h-52">
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
        {page.icon && <div className="text-4xl">{page.icon}</div>}
        <h1 className="text-4xl font-bold">{page.title || "Untitled"}</h1>
      </header>

      <div className="mt-6">
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
      </div>
    </main>
  );
}
