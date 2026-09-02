import Link from "next/link";
import { CornerUpLeft } from "lucide-react";

export interface Backlink {
  id: string;
  title: string;
  icon: string | null;
}

/** Pages that link to or mention this one (brief §5 backlinks panel). */
export function BacklinksPanel({
  workspaceId,
  backlinks,
}: {
  workspaceId: string;
  backlinks: Backlink[];
}) {
  if (backlinks.length === 0) return null;
  return (
    <section className="mt-8 space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <CornerUpLeft className="size-4" /> Linked from
      </h2>
      <ul className="flex flex-wrap gap-2">
        {backlinks.map((page) => (
          <li key={page.id}>
            <Link
              href={`/w/${workspaceId}/p/${page.id}`}
              className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm hover:bg-accent"
            >
              <span className="w-4 text-center">{page.icon ?? "📄"}</span>
              <span className="truncate">{page.title || "Untitled"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
