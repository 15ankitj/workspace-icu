import Link from "next/link";
import { CornerUpLeft } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/page-shell";

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
  return (
    <section className="space-y-2">
      <SectionHeading>
        <CornerUpLeft className="size-4" aria-hidden /> Linked from
      </SectionHeading>
      {backlinks.length === 0 ? (
        <EmptyState compact>
          No other page links here yet. Type @ in any page to link to this one.
        </EmptyState>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {backlinks.map((page) => (
            <li key={page.id} className="max-w-full">
              <Link
                href={`/w/${workspaceId}/p/${page.id}`}
                className="flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-sm hover:bg-accent"
              >
                <span className="w-4 shrink-0 text-center" aria-hidden>
                  {page.icon ?? "📄"}
                </span>
                <span className="truncate">{page.title || "Untitled"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
