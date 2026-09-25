"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { EyeOff, Plus, X } from "lucide-react";
import {
  addRelationLink,
  moveRelationLink,
  removeRelationLink,
} from "@/app/actions/relations";
import { PagePicker, type PickablePage } from "@/components/page/page-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { MAX_RELATION_LINKS } from "@/lib/page-properties";
import {
  positionForMove,
  sortLinks,
  suggestReverseLabel,
  type RelationLink,
  type RelationPage,
  type RelationRow,
} from "@/lib/relations";
import { cn } from "@/lib/utils";

/**
 * A page as a chip: icon and title, linking to the page. A page in the
 * trash is shown muted and not linked (§4.3); it comes back on restore.
 */
export function RelationChip({
  page,
  workspaceId,
  onRemove,
  className,
}: {
  page: RelationPage;
  workspaceId: string;
  onRemove?: () => void;
  className?: string;
}) {
  const title = page.title || "Untitled";
  const body = (
    <>
      <span className="w-4 shrink-0 text-center" aria-hidden>
        {page.icon ?? "📄"}
      </span>
      <span className="truncate">{title}</span>
      {page.trashed && <span className="shrink-0 italic">(in trash)</span>}
    </>
  );
  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-muted pl-2 text-sm",
        onRemove ? "pr-0.5" : "pr-2",
        page.trashed && "text-muted-foreground",
        className,
      )}
    >
      {page.trashed ? (
        <span className="flex min-w-0 items-center gap-1">{body}</span>
      ) : (
        <Link
          href={`/w/${workspaceId}/p/${page.id}`}
          className="flex min-w-0 items-center gap-1 rounded-full hover:underline"
        >
          {body}
        </Link>
      )}
      {onRemove && (
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
          aria-label={`Remove ${title}`}
          onClick={onRemove}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </span>
  );
}

/**
 * A link whose page the viewer cannot see (§4.2): the synced-block rule,
 * a neutral placeholder and never the title. It cannot be removed or
 * moved from here, since that would need edit rights on both pages.
 */
export function HiddenRelationChip() {
  return (
    <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-dashed px-2 text-sm text-muted-foreground">
      <EyeOff className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">A page you don&apos;t have access to</span>
    </span>
  );
}

/**
 * The chips of one relation in stored order, with drag to reorder (and
 * Alt+arrow for keyboards) when `onMove` is given, then a placeholder
 * for each of the `hidden` links whose page the viewer cannot see.
 */
export function RelationChips({
  links,
  hidden = 0,
  workspaceId,
  onRemove,
  onMove,
  className,
}: {
  links: RelationLink[];
  hidden?: number;
  workspaceId: string;
  onRemove?: (link: RelationLink) => void;
  onMove?: (from: number, to: number) => void;
  className?: string;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return (
    <ul
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      aria-label={onMove ? "Linked pages, drag to reorder" : "Linked pages"}
    >
      {links.map((link, index) => (
        <li
          key={link.id}
          className={cn(
            "max-w-full rounded-full",
            onMove && "cursor-grab",
            dragIndex === index && "opacity-50",
            overIndex === index && dragIndex !== index && "ring-2 ring-ring",
          )}
          draggable={Boolean(onMove)}
          onDragStart={(e) => {
            if (!onMove) return;
            e.dataTransfer.effectAllowed = "move";
            setDragIndex(index);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
          }}
          onDragOver={(e) => {
            if (dragIndex === null || dragIndex === index) return;
            e.preventDefault();
            setOverIndex(index);
          }}
          onDragLeave={() => setOverIndex(null)}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null && dragIndex !== index) {
              onMove?.(dragIndex, index);
            }
            setDragIndex(null);
            setOverIndex(null);
          }}
          onKeyDown={(e) => {
            if (!onMove || !e.altKey) return;
            if (e.key === "ArrowLeft" && index > 0) {
              e.preventDefault();
              onMove(index, index - 1);
            } else if (e.key === "ArrowRight" && index < links.length - 1) {
              e.preventDefault();
              onMove(index, index + 1);
            }
          }}
        >
          <RelationChip
            page={link.page}
            workspaceId={workspaceId}
            onRemove={onRemove ? () => onRemove(link) : undefined}
          />
        </li>
      ))}
      {Array.from({ length: hidden }, (_, i) => (
        <li key={`hidden-${i}`} className="max-w-full">
          <HiddenRelationChip />
        </li>
      ))}
    </ul>
  );
}

/**
 * "Add page": the workspace page search behind `@` and page links, in a
 * menu. Pages already linked show a tick and picking one again removes
 * it, so the menu is a multi-select.
 */
export function AddPagesMenu({
  pages,
  selectedIds,
  excludeIds,
  onPick,
  label = "Add page",
  disabled,
}: {
  pages: PickablePage[];
  selectedIds: ReadonlySet<string>;
  excludeIds: ReadonlySet<string>;
  onPick: (page: PickablePage) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground"
          disabled={disabled}
        >
          <Plus /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-2">
        <PagePicker
          pages={pages}
          selectedIds={selectedIds}
          excludeIds={excludeIds}
          onPick={onPick}
          placeholder="Find a page…"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PENDING = "pending-";

/**
 * The value of a relation row on its own page: chips in order, add,
 * remove, reorder. Optimistic: the parent holds the links and every
 * change is a function of the latest list, so two quick edits cannot
 * overwrite each other; a refused write is undone and explained.
 */
export function RelationValue({
  row,
  links,
  hidden,
  pages,
  pageId,
  workspaceId,
  canEdit,
  onChange,
}: {
  row: RelationRow;
  links: RelationLink[];
  /** Links to pages the viewer cannot see, shown as placeholders. */
  hidden: number;
  pages: PickablePage[];
  pageId: string;
  workspaceId: string;
  canEdit: boolean;
  onChange: (update: (current: RelationLink[]) => RelationLink[]) => void;
}) {
  const [, startTransition] = useTransition();
  const ordered = sortLinks(links);
  const linkedIds = new Set(ordered.map((l) => l.page.id));

  function fail(title: string, error: unknown) {
    toast({
      variant: "destructive",
      title,
      description: error instanceof Error ? error.message : "Please try again.",
    });
  }

  const add = (page: PickablePage) => {
    if (ordered.length + hidden >= MAX_RELATION_LINKS) {
      toast({
        variant: "destructive",
        title: `A relation holds at most ${MAX_RELATION_LINKS} pages`,
      });
      return;
    }
    const temp: RelationLink = {
      id: `${PENDING}${page.id}`,
      position: (ordered.at(-1)?.position ?? "a0") + "V",
      page: { id: page.id, title: page.title, icon: page.icon, trashed: false },
    };
    onChange((current) => [...current, temp]);
    startTransition(async () => {
      try {
        const saved = await addRelationLink(pageId, row.id, page.id);
        onChange((current) =>
          current.map((l) =>
            l.id === temp.id
              ? { ...l, id: saved.id, position: saved.position }
              : l,
          ),
        );
      } catch (error) {
        onChange((current) => current.filter((l) => l.id !== temp.id));
        fail("Couldn't link the page", error);
      }
    });
  };

  const remove = (link: RelationLink) => {
    if (link.id.startsWith(PENDING)) {
      toast({ title: "Still saving that link — try again in a moment." });
      return;
    }
    onChange((current) => current.filter((l) => l.id !== link.id));
    startTransition(async () => {
      try {
        await removeRelationLink(link.id);
      } catch (error) {
        onChange((current) =>
          current.some((l) => l.id === link.id) ? current : [...current, link],
        );
        fail("Couldn't remove the link", error);
      }
    });
  };

  const move = (from: number, to: number) => {
    const position = positionForMove(ordered, from, to);
    const moved = ordered[from];
    if (!position || !moved || moved.id.startsWith(PENDING)) return;
    const restore = moved.position;
    onChange((current) =>
      current.map((l) => (l.id === moved.id ? { ...l, position } : l)),
    );
    startTransition(async () => {
      try {
        await moveRelationLink(moved.id, position);
      } catch (error) {
        onChange((current) =>
          current.map((l) =>
            l.id === moved.id ? { ...l, position: restore } : l,
          ),
        );
        fail("Couldn't reorder", error);
      }
    });
  };

  const pick = (page: PickablePage) => {
    const existing = ordered.find((l) => l.page.id === page.id);
    if (existing) remove(existing);
    else add(page);
  };

  const anything = ordered.length > 0 || hidden > 0;
  if (!canEdit) {
    return anything ? (
      <RelationChips
        links={ordered}
        hidden={hidden}
        workspaceId={workspaceId}
      />
    ) : (
      <span className="text-muted-foreground">Empty</span>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      {anything && (
        <RelationChips
          links={ordered}
          hidden={hidden}
          workspaceId={workspaceId}
          onRemove={remove}
          onMove={move}
        />
      )}
      <AddPagesMenu
        pages={pages}
        selectedIds={linkedIds}
        excludeIds={new Set([pageId])}
        onPick={pick}
        label={anything ? "Add" : "Add page"}
      />
    </div>
  );
}

/**
 * Name a relation: its label and what the other page calls it (§4.1 rule
 * 1). Used when adding the property and when renaming it.
 */
export function RelationLabelsDialog({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: { label: string; reverseLabel: string } | null;
  onSave: (labels: { label: string; reverseLabel: string }) => void;
  onClose: () => void;
}) {
  const labelId = useId();
  const reverseId = useId();
  const creating = initial === null;
  const [label, setLabel] = useState(initial?.label ?? "");
  const [reverse, setReverse] = useState(initial?.reverseLabel ?? "");
  const [reverseTouched, setReverseTouched] = useState(!creating);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = label.trim().slice(0, 40);
    if (!cleanLabel) return;
    const cleanReverse =
      reverse.trim().slice(0, 40) || suggestReverseLabel(cleanLabel);
    onSave({ label: cleanLabel, reverseLabel: cleanReverse });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <DialogTitle>
              {creating ? "Add a relation" : "Rename the relation"}
            </DialogTitle>
            <DialogDescription>
              A relation links this page to other pages in the workspace. Each
              linked page shows the connection under the reverse name.
            </DialogDescription>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={labelId}>Name on this page</Label>
            <Input
              id={labelId}
              autoFocus
              required
              maxLength={40}
              placeholder="Evidence"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (!reverseTouched) {
                  setReverse(suggestReverseLabel(e.target.value));
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={reverseId}>Name on the linked pages</Label>
            <Input
              id={reverseId}
              maxLength={40}
              placeholder="Evidence for"
              value={reverse}
              onChange={(e) => {
                setReverseTouched(true);
                setReverse(e.target.value);
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!label.trim()}>
              {creating ? "Add relation" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
