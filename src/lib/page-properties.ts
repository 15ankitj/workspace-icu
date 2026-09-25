/**
 * Page details (migration 0014): the bounded set of properties a page can
 * show under its title. Deliberately not a database — six value types,
 * no rollups, no views — but shaped so v2 databases can lift the rows.
 * The sixth, relation (Appendix B, migration 0025), declares a link to
 * other pages: the row lives here, the pages it holds live in
 * `page_relations`. Pure: the server action normalises through here
 * before writing, and the client renders from the same types.
 */

export const PROPERTY_TYPES = [
  "people",
  "date",
  "select",
  "link",
  "text",
  "relation",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

/**
 * Appendix B §4.4, designed only: a relation row that is the reverse side
 * of another page's relation row, so the reverse side can be a normal,
 * positionable property. Nothing reads it yet; it is kept so no migration
 * is needed when it is.
 */
export interface RelationReverseOf {
  page_id?: string;
  property_id: string;
}

export type PagePropertyRow =
  | { id: string; type: "people"; label: string; value: string[] }
  | { id: string; type: "date"; label: string; value: string | null }
  | { id: string; type: "select"; label: string; value: string | null }
  | { id: string; type: "link"; label: string; value: string }
  | { id: string; type: "text"; label: string; value: string }
  | {
      id: string;
      type: "relation";
      label: string;
      /** What the target page calls the connection ("Evidence for"). */
      reverse_label: string;
      reverse_of?: RelationReverseOf;
    };

/** Rows every page has; they can be hidden per page but not deleted. */
export const SYSTEM_PROPERTIES = ["created_by", "updated_by"] as const;
export type SystemProperty = (typeof SYSTEM_PROPERTIES)[number];

export interface PageProperties {
  hidden: SystemProperty[];
  rows: PagePropertyRow[];
}

export const EMPTY_PROPERTIES: PageProperties = { hidden: [], rows: [] };

export const PROPERTY_LABELS: Record<PropertyType, string> = {
  people: "People",
  date: "Date",
  select: "Type",
  link: "Link",
  text: "Text",
  relation: "Relation",
};

export const PROPERTY_HINTS: Record<PropertyType, string> = {
  people: "workspace members",
  date: "",
  select: "one of a list",
  link: "",
  text: "",
  relation: "pages in this workspace",
};

export const MAX_ROWS = 20;
/** Pages one relation property can hold (Appendix B §7, proposed). The
 *  database enforces the same number. */
export const MAX_RELATION_LINKS = 200;
const MAX_LABEL = 40;
const MAX_TEXT = 500;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanLabel(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, MAX_LABEL);
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
}

export function isValidLink(value: string): boolean {
  if (value.length > MAX_TEXT) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** The reverse label a relation gets until someone names it. */
export function defaultReverseLabel(label: string): string {
  return `Related: ${label}`.slice(0, MAX_LABEL);
}

function normalizeReverseOf(input: unknown): RelationReverseOf | undefined {
  if (!isRecord(input)) return undefined;
  const propertyId =
    typeof input.property_id === "string" ? input.property_id : "";
  if (!ID_PATTERN.test(propertyId)) return undefined;
  const pageId = input.page_id;
  return typeof pageId === "string" && UUID_PATTERN.test(pageId)
    ? { page_id: pageId.toLowerCase(), property_id: propertyId }
    : { property_id: propertyId };
}

function normalizeRow(input: unknown): PagePropertyRow | null {
  if (!isRecord(input)) return null;
  const id = typeof input.id === "string" ? input.id : "";
  if (!ID_PATTERN.test(id)) return null;
  const type = input.type;
  if (!PROPERTY_TYPES.includes(type as PropertyType)) return null;
  const label = cleanLabel(input.label, PROPERTY_LABELS[type as PropertyType]);
  const value = input.value;
  switch (type as PropertyType) {
    case "people":
      return {
        id,
        type: "people",
        label,
        value: Array.isArray(value)
          ? [
              ...new Set(
                value.filter(
                  (v): v is string =>
                    typeof v === "string" && UUID_PATTERN.test(v),
                ),
              ),
            ].slice(0, 50)
          : [],
      };
    case "date":
      return {
        id,
        type: "date",
        label,
        value:
          typeof value === "string" && DATE_PATTERN.test(value) ? value : null,
      };
    case "select":
      return {
        id,
        type: "select",
        label,
        value: cleanText(value).slice(0, 60) || null,
      };
    case "link": {
      const text = cleanText(value);
      return { id, type: "link", label, value: isValidLink(text) ? text : "" };
    }
    case "text":
      return { id, type: "text", label, value: cleanText(value) };
    case "relation": {
      // The row declares the relation; its pages are in `page_relations`,
      // so any value supplied is dropped rather than stored twice.
      const reverseOf = normalizeReverseOf(input.reverse_of);
      return {
        id,
        type: "relation",
        label,
        reverse_label: cleanLabel(
          input.reverse_label,
          defaultReverseLabel(label),
        ),
        ...(reverseOf && { reverse_of: reverseOf }),
      };
    }
  }
}

/**
 * Accept anything (a jsonb column, a client payload) and return a valid
 * PageProperties: unknown rows are dropped, values clamped, ids unique.
 */
export function normalizeProperties(input: unknown): PageProperties {
  if (!isRecord(input)) return { hidden: [], rows: [] };
  const hidden = Array.isArray(input.hidden)
    ? [
        ...new Set(
          input.hidden.filter((h): h is SystemProperty =>
            SYSTEM_PROPERTIES.includes(h as SystemProperty),
          ),
        ),
      ]
    : [];
  const rows: PagePropertyRow[] = [];
  const seen = new Set<string>();
  if (Array.isArray(input.rows)) {
    for (const raw of input.rows) {
      const row = normalizeRow(raw);
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
      if (rows.length >= MAX_ROWS) break;
    }
  }
  return { hidden, rows };
}

/** A fresh, empty row of the given type. */
export function newPropertyRow(
  type: PropertyType,
  id: string,
): PagePropertyRow {
  const label = PROPERTY_LABELS[type];
  switch (type) {
    case "people":
      return { id, type, label, value: [] };
    case "date":
      return { id, type, label, value: null };
    case "select":
      return { id, type, label, value: null };
    case "link":
      return { id, type, label, value: "" };
    case "text":
      return { id, type, label, value: "" };
    case "relation":
      return { id, type, label, reverse_label: defaultReverseLabel(label) };
  }
}

/**
 * What a template carries: the rows and which system rows are hidden, with
 * people and dates cleared (they belong to the source page, not the copy).
 * Select, link and text values travel, since they are usually part of the
 * template's meaning ("Type: Supervision"). A relation row travels with
 * its labels; the links it holds are the snapshot's business (Appendix B
 * §4.5), not the row's.
 */
export function propertiesForTemplate(input: unknown): PageProperties {
  const props = normalizeProperties(input);
  return {
    hidden: props.hidden,
    rows: props.rows.map((row) => {
      if (row.type === "people") return { ...row, value: [] };
      if (row.type === "date") return { ...row, value: null };
      return row;
    }),
  };
}

/**
 * True when a row carries something worth showing in a summary. A relation
 * row never does on its own: how many pages it holds is known only to
 * whoever loaded `page_relations`.
 */
export function hasValue(row: PagePropertyRow): boolean {
  if (row.type === "relation") return false;
  if (row.type === "people") return row.value.length > 0;
  return Boolean(row.value);
}

/** Small stable id for a new row, safe in both server and browser. */
export function propertyId(): string {
  const bytes =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto.getRandomValues(new Uint8Array(6))
      : Uint8Array.from({ length: 6 }, () => Math.floor(Math.random() * 256));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
