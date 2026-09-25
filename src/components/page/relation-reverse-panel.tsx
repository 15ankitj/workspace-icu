"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";
import {
  addRelationFromReverse,
  removeRelationLink,
} from "@/app/actions/relations";
import type { PickablePage } from "@/components/page/page-picker";
import { AddPagesMenu, RelationChip } from "@/components/page/relation-value";
import { toast } from "@/components/ui/toast";
import type { ReverseGroup } from "@/lib/relations";

const PENDING = "pending-";

/**
 * The reverse side of relations (Appendix B §4.1 rule 4): under each
 * reverse label, the pages whose relation holds this page, with the same
 * chips and add/remove as the forward side. Adding here makes the other
 * page the source (it gets a relation row with that label if it has
 * none). Shown directly under the page's properties, before Sub-pages
 * (§7), and only when there is something to show.
 */
export function RelationReversePanel({
  workspaceId,
  pageId,
  groups: initial,
  pages,
  canEdit,
}: {
  workspaceId: string;
  pageId: string;
  groups: ReverseGroup[];
  pages: PickablePage[];
  canEdit: boolean;
}) {
  const [groups, setGroups] = useState(initial);
  const [, startTransition] = useTransition();

  function update(
    key: string,
    change: (links: ReverseGroup["links"]) => ReverseGroup["links"],
  ) {
    setGroups((current) =>
      current.map((g) =>
        g.key === key ? { ...g, links: change(g.links) } : g,
      ),
    );
  }

  function fail(title: string, error: unknown) {
    toast({
      variant: "destructive",
      title,
      description: error instanceof Error ? error.message : "Please try again.",
    });
  }

  const add = (group: ReverseGroup, page: PickablePage) => {
    const tempId = `${PENDING}${page.id}`;
    const temp = {
      id: tempId,
      page: { id: page.id, title: page.title, icon: page.icon, trashed: false },
    };
    update(group.key, (links) => [...links, temp]);
    startTransition(async () => {
      try {
        const saved = await addRelationFromReverse(
          pageId,
          page.id,
          group.label,
          group.reverseLabel,
        );
        update(group.key, (links) =>
          links.map((l) => (l.id === tempId ? { ...l, id: saved.id } : l)),
        );
      } catch (error) {
        update(group.key, (links) => links.filter((l) => l.id !== tempId));
        fail("Couldn't link the page", error);
      }
    });
  };

  const remove = (group: ReverseGroup, link: ReverseGroup["links"][number]) => {
    if (link.id.startsWith(PENDING)) {
      toast({ title: "Still saving that link — try again in a moment." });
      return;
    }
    update(group.key, (links) => links.filter((l) => l.id !== link.id));
    startTransition(async () => {
      try {
        await removeRelationLink(link.id);
      } catch (error) {
        update(group.key, (links) =>
          links.some((l) => l.id === link.id) ? links : [...links, link],
        );
        fail("Couldn't remove the link", error);
      }
    });
  };

  const visible = groups.filter((g) => g.links.length > 0 || canEdit);
  if (visible.length === 0) return null;

  return (
    <section aria-label="Linked from" className="flex flex-col gap-0.5 text-sm">
      {visible.map((group) => {
        const linked = new Set(group.links.map((l) => l.page.id));
        return (
          <div
            key={group.key}
            className="group/row -mx-2 flex min-h-8 items-center gap-3 rounded-md px-2 hover:bg-muted/60"
          >
            <span
              className="flex w-40 shrink-0 items-center gap-2 text-sm text-muted-foreground"
              title={`Pages whose “${group.label}” includes this page`}
            >
              <ArrowLeftRight className="size-4" aria-hidden />
              <span className="truncate">{group.reverseLabel}</span>
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {group.links.map((link) => (
                <RelationChip
                  key={link.id}
                  page={link.page}
                  workspaceId={workspaceId}
                  onRemove={canEdit ? () => remove(group, link) : undefined}
                />
              ))}
              {canEdit && (
                <AddPagesMenu
                  pages={pages}
                  selectedIds={linked}
                  excludeIds={new Set([pageId])}
                  onPick={(page) => {
                    const existing = group.links.find(
                      (l) => l.page.id === page.id,
                    );
                    if (existing) remove(group, existing);
                    else add(group, page);
                  }}
                  label="Add"
                />
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
