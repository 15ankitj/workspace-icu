"use client";

import { useId, useRef, useState, useTransition } from "react";
import {
  AlignLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleUser,
  EyeOff,
  History,
  Link as LinkIcon,
  MoreHorizontal,
  Plus,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { setPageProperties } from "@/app/actions/pages";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  PROPERTY_HINTS,
  PROPERTY_LABELS,
  PROPERTY_TYPES,
  hasValue,
  isValidLink,
  newPropertyRow,
  propertyId,
  type PageProperties,
  type PagePropertyRow,
  type PropertyType,
  type SystemProperty,
} from "@/lib/page-properties";
import { formatDate, formatPropertyDate, formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface Person {
  id: string;
  name: string;
}

const TYPE_ICONS: Record<PropertyType, typeof Users> = {
  people: Users,
  date: Calendar,
  select: Tag,
  link: LinkIcon,
  text: AlignLeft,
};

const rowClass =
  "group/row flex min-h-8 items-center gap-3 rounded-md -mx-2 px-2 hover:bg-muted/60";
const labelClass =
  "flex w-40 shrink-0 items-center gap-2 text-sm text-muted-foreground";

/**
 * The details block under the title: who made and last changed the page,
 * plus the page's own properties. Everything saves on change; nothing here
 * is a database (brief §5 keeps those for v2).
 */
export function PageDetails({
  pageId,
  initial,
  created,
  edited,
  members,
  siblingSelectValues,
  canEdit,
}: {
  pageId: string;
  initial: PageProperties;
  created: { id: string; name: string; at: string };
  edited: { id: string | null; name: string; at: string };
  members: Person[];
  /** Existing "Type"-style values on sibling pages, offered as options. */
  siblingSelectValues: string[];
  canEdit: boolean;
}) {
  const [props, setProps] = useState<PageProperties>(initial);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const lastGood = useRef<PageProperties>(initial);

  function commit(next: PageProperties) {
    const previous = props;
    setProps(next);
    startTransition(async () => {
      try {
        const saved = await setPageProperties(pageId, next);
        lastGood.current = saved;
      } catch (error) {
        setProps(previous);
        toast({
          variant: "destructive",
          title: "Couldn't save page details",
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      }
    });
  }

  const updateRow = (id: string, patch: Partial<PagePropertyRow>) =>
    commit({
      ...props,
      rows: props.rows.map((r) =>
        r.id === id ? ({ ...r, ...patch } as PagePropertyRow) : r,
      ),
    });
  const removeRow = (id: string) =>
    commit({ ...props, rows: props.rows.filter((r) => r.id !== id) });
  const moveRow = (id: string, delta: -1 | 1) => {
    const index = props.rows.findIndex((r) => r.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= props.rows.length) return;
    const rows = [...props.rows];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    commit({ ...props, rows });
  };
  const setHidden = (key: SystemProperty, hidden: boolean) =>
    commit({
      ...props,
      hidden: hidden
        ? [...new Set([...props.hidden, key])]
        : props.hidden.filter((h) => h !== key),
    });
  const addRow = (type: PropertyType) =>
    commit({
      ...props,
      rows: [...props.rows, newPropertyRow(type, propertyId())],
    });

  const memberById = new Map(members.map((m) => [m.id, m.name]));
  const showCreated = !props.hidden.includes("created_by");
  const showEdited = !props.hidden.includes("updated_by");
  const filled = props.rows.filter(hasValue);
  const nothingToShow =
    !showCreated && !showEdited && props.rows.length === 0 && !canEdit;
  if (nothingToShow) return null;

  const summaryPeople = props.rows
    .filter(
      (r): r is Extract<PagePropertyRow, { type: "people" }> =>
        r.type === "people",
    )
    .flatMap((r) => r.value)
    .map((id) => ({ id, name: memberById.get(id) ?? "Unknown" }));
  const summaryBits = [
    ...filled
      .filter((r) => r.type !== "people")
      .map((r) =>
        r.type === "date" && r.value ? formatPropertyDate(r.value) : r.value,
      ),
    showEdited ? `edited ${formatRelative(edited.at)}` : null,
  ].filter(Boolean);

  return (
    <section aria-label="Page details" className="text-sm">
      {/* Phone: one tappable line that expands. */}
      <button
        type="button"
        className="flex h-11 w-full items-center gap-2 rounded-md border px-3 text-left text-[13px] text-muted-foreground md:hidden"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {summaryPeople.length > 0 && (
          <span className="flex items-center">
            {summaryPeople.slice(0, 3).map((p, i) => (
              <Avatar
                key={p.id}
                id={p.id}
                name={p.name}
                size="xs"
                className={cn("ring-2 ring-background", i > 0 && "-ml-1.5")}
              />
            ))}
          </span>
        )}
        <span className="min-w-0 truncate">
          {summaryBits.length > 0 ? summaryBits.join(" · ") : "Page details"}
        </span>
        <ChevronDown
          className={cn("ml-auto size-4 shrink-0", open && "rotate-180")}
          aria-hidden
        />
      </button>

      <div
        className={cn(
          "flex-col gap-0.5",
          open ? "mt-2 flex" : "hidden md:flex",
        )}
      >
        {showCreated && (
          <SystemRow
            icon={CircleUser}
            label="Created by"
            canEdit={canEdit}
            onHide={() => setHidden("created_by", true)}
          >
            <Avatar id={created.id} name={created.name} />
            <span>{created.name}</span>
            <span className="text-muted-foreground">
              · {formatDate(created.at)}
            </span>
          </SystemRow>
        )}
        {showEdited && (
          <SystemRow
            icon={History}
            label="Last edited"
            canEdit={canEdit}
            onHide={() => setHidden("updated_by", true)}
          >
            {edited.id && <Avatar id={edited.id} name={edited.name} />}
            <span>{edited.name}</span>
            <span className="text-muted-foreground">
              · {formatRelative(edited.at)}
            </span>
          </SystemRow>
        )}

        {props.rows.map((row, index) => {
          const Icon = TYPE_ICONS[row.type];
          return (
            <div key={row.id} className={rowClass}>
              <span className={labelClass}>
                <Icon className="size-4" aria-hidden />
                <span className="truncate">{row.label}</span>
              </span>
              <div className="flex min-w-0 flex-1 items-center">
                <PropertyValue
                  row={row}
                  members={members}
                  memberById={memberById}
                  siblingSelectValues={siblingSelectValues}
                  canEdit={canEdit}
                  onChange={(patch) => updateRow(row.id, patch)}
                />
              </div>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
                      aria-label={`Options for ${row.label}`}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={index === 0}
                      onSelect={() => moveRow(row.id, -1)}
                    >
                      <ChevronUp /> Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={index === props.rows.length - 1}
                      onSelect={() => moveRow(row.id, 1)}
                    >
                      <ChevronDown /> Move down
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => removeRow(row.id)}
                    >
                      <Trash2 /> Remove from this page
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}

        {canEdit && (
          <div className="-mx-2 flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  disabled={props.rows.length >= 20}
                >
                  <Plus /> Add a property
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Property type</DropdownMenuLabel>
                {PROPERTY_TYPES.map((type) => {
                  const Icon = TYPE_ICONS[type];
                  return (
                    <DropdownMenuItem key={type} onSelect={() => addRow(type)}>
                      <Icon /> {PROPERTY_LABELS[type]}
                      {PROPERTY_HINTS[type] && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {PROPERTY_HINTS[type]}
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
                {props.hidden.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Hidden on this page</DropdownMenuLabel>
                    {props.hidden.includes("created_by") && (
                      <DropdownMenuItem
                        onSelect={() => setHidden("created_by", false)}
                      >
                        <CircleUser /> Created by
                        <span className="ml-auto text-xs text-muted-foreground">
                          Show
                        </span>
                      </DropdownMenuItem>
                    )}
                    {props.hidden.includes("updated_by") && (
                      <DropdownMenuItem
                        onSelect={() => setHidden("updated_by", false)}
                      >
                        <History /> Last edited
                        <span className="ml-auto text-xs text-muted-foreground">
                          Show
                        </span>
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {props.hidden.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {props.hidden.length} hidden
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function SystemRow({
  icon: Icon,
  label,
  canEdit,
  onHide,
  children,
}: {
  icon: typeof Users;
  label: string;
  canEdit: boolean;
  onHide: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={rowClass}>
      <span className={labelClass}>
        <Icon className="size-4" aria-hidden />
        {label}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
              aria-label={`Options for ${label}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onSelect={onHide}>
              <EyeOff /> Hide on this page
            </DropdownMenuItem>
            <DropdownMenuLabel className="normal-case tracking-normal">
              Always tracked; hiding only removes the row.
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function PropertyValue({
  row,
  members,
  memberById,
  siblingSelectValues,
  canEdit,
  onChange,
}: {
  row: PagePropertyRow;
  members: Person[];
  memberById: Map<string, string>;
  siblingSelectValues: string[];
  canEdit: boolean;
  onChange: (patch: Partial<PagePropertyRow>) => void;
}) {
  const inputId = useId();
  const empty = <span className="text-muted-foreground">Empty</span>;

  switch (row.type) {
    case "people": {
      const chips = row.value.map((id) => (
        <span
          key={id}
          className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2"
        >
          <Avatar id={id} name={memberById.get(id) ?? "Unknown"} size="xs" />
          {memberById.get(id) ?? "Unknown"}
        </span>
      ));
      if (!canEdit)
        return chips.length ? (
          <span className="flex flex-wrap gap-1.5">{chips}</span>
        ) : (
          empty
        );
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-md px-1 text-left hover:bg-accent"
              aria-label={`${row.label}: ${row.value.length ? row.value.map((id) => memberById.get(id) ?? "Unknown").join(", ") : "empty"}`}
            >
              {chips.length ? chips : empty}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Workspace members</DropdownMenuLabel>
            {members.map((m) => (
              <DropdownMenuCheckboxItem
                key={m.id}
                checked={row.value.includes(m.id)}
                onCheckedChange={(checked) =>
                  onChange({
                    value: checked
                      ? [...row.value, m.id]
                      : row.value.filter((id) => id !== m.id),
                  })
                }
                onSelect={(e) => e.preventDefault()}
              >
                <Avatar id={m.id} name={m.name} size="xs" /> {m.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    case "date":
      if (!canEdit)
        return row.value ? <span>{formatPropertyDate(row.value)}</span> : empty;
      return (
        <div className="flex items-center gap-1">
          <label htmlFor={inputId} className="sr-only">
            {row.label}
          </label>
          <Input
            id={inputId}
            type="datetime-local"
            value={row.value ?? ""}
            onChange={(e) => onChange({ value: e.target.value || null })}
            className="h-8 w-56 shadow-none"
          />
          {row.value && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear date"
              onClick={() => onChange({ value: null })}
            >
              <X />
            </Button>
          )}
        </div>
      );
    case "select": {
      const options = [
        ...new Set([...(row.value ? [row.value] : []), ...siblingSelectValues]),
      ];
      const badge = row.value ? (
        <Badge variant="muted">{row.value}</Badge>
      ) : (
        empty
      );
      if (!canEdit) return badge;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 items-center rounded-md px-1 hover:bg-accent"
              aria-label={`${row.label}: ${row.value ?? "empty"}`}
            >
              {badge}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {options.map((value) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={row.value === value}
                onCheckedChange={(checked) =>
                  onChange({ value: checked ? value : null })
                }
              >
                {value}
              </DropdownMenuCheckboxItem>
            ))}
            {options.length > 0 && <DropdownMenuSeparator />}
            <form
              className="flex gap-1 p-1"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const value = String(data.get("value") ?? "").trim();
                if (value) onChange({ value: value.slice(0, 60) });
              }}
            >
              <Input
                name="value"
                placeholder="New option…"
                aria-label="New option"
                className="h-8"
                onKeyDown={(e) => e.stopPropagation()}
              />
              <Button type="submit" size="sm" variant="secondary">
                Set
              </Button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    case "link":
      if (!canEdit)
        return row.value ? (
          <a
            href={row.value}
            target="_blank"
            rel="noreferrer noopener"
            className="truncate underline underline-offset-4"
          >
            {row.value}
          </a>
        ) : (
          empty
        );
      return (
        <TextValue
          id={inputId}
          label={row.label}
          value={row.value}
          placeholder="https://…"
          validate={(v) =>
            v === "" || isValidLink(v)
              ? null
              : "Needs to be a full http(s) link."
          }
          onCommit={(value) => onChange({ value })}
        />
      );
    case "text":
      if (!canEdit)
        return row.value ? (
          <span className="whitespace-pre-wrap">{row.value}</span>
        ) : (
          empty
        );
      return (
        <TextValue
          id={inputId}
          label={row.label}
          value={row.value}
          placeholder="Empty"
          validate={() => null}
          onCommit={(value) => onChange({ value })}
        />
      );
  }
}

/** An inline text field that saves on blur or Enter and reports validity. */
function TextValue({
  id,
  label,
  value,
  placeholder,
  validate,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  validate: (value: string) => string | null;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const trimmed = draft.trim();
    const problem = validate(trimmed);
    setError(problem);
    if (!problem && trimmed !== value) onCommit(trimmed);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        value={draft}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="h-8 w-full min-w-0 rounded-md bg-transparent px-1 placeholder:text-muted-foreground focus-visible:bg-accent focus-visible:outline-none"
      />
      {error && (
        <span role="alert" className="px-1 text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
