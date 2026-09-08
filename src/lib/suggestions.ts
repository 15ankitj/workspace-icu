/**
 * Suggestion mode (Appendix A, Part 2): pure helpers shared by the editor,
 * the server actions and the save path. A suggestion is a set of marks in
 * the collaborative document; its id carries the suggester so attribution
 * needs no lookup, and so ids from different clients never collide.
 */

export type SuggestionKind = "insertion" | "deletion" | "modification";

export type SuggestionStatus = "open" | "accepted" | "rejected" | "withdrawn";

/** `<user id>:<random>` — the user id is the first 8 hex chars of the uuid. */
const ID_PATTERN = /^([0-9a-f]{8}):([0-9a-z]{4,20})$/i;

export function makeSuggestionId(
  userId: string,
  random: () => number = Math.random,
): string {
  const prefix = userId.replace(/-/g, "").slice(0, 8).toLowerCase();
  const nonce = Math.floor(random() * 36 ** 8)
    .toString(36)
    .padStart(8, "0");
  return `${prefix}:${nonce}`;
}

/** The user-id prefix the id was minted with; null for foreign ids. */
export function suggesterPrefix(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const match = id.match(ID_PATTERN);
  return match ? match[1].toLowerCase() : null;
}

/** Whether `userId` minted this suggestion id. */
export function isOwnSuggestion(id: unknown, userId: string): boolean {
  const prefix = suggesterPrefix(id);
  return (
    prefix !== null &&
    prefix === userId.replace(/-/g, "").slice(0, 8).toLowerCase()
  );
}

/** Resolve a suggester prefix to a display name from the workspace members. */
export function suggesterName(
  id: unknown,
  members: { id: string; displayName: string }[],
): string | null {
  const prefix = suggesterPrefix(id);
  if (!prefix) return null;
  const member = members.find(
    (m) => m.id.replace(/-/g, "").slice(0, 8).toLowerCase() === prefix,
  );
  return member?.displayName ?? null;
}

/** A short excerpt of suggested text for the index and the panel. */
export function excerptOf(text: string, max = 80): string {
  const flat = text
    .replace(/\u200b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export type PageMode = "edit" | "suggest" | "view";

/**
 * The mode a page opens in (brief §2.2): authors of authored pages edit;
 * everyone else who can edit suggests; those who cannot edit view. A
 * voluntary switch to Suggest is respected; Edit on an authored page is
 * only for authors, whatever was remembered.
 */
export function defaultPageMode(input: {
  canEdit: boolean;
  authored: boolean;
  isAuthor: boolean;
  suggestionsAvailable: boolean;
  remembered?: PageMode | null;
}): PageMode {
  if (!input.canEdit) return "view";
  const forcedSuggest = input.authored && !input.isAuthor;
  if (forcedSuggest) return input.suggestionsAvailable ? "suggest" : "view";
  if (input.remembered === "suggest" && input.suggestionsAvailable) {
    return "suggest";
  }
  if (input.remembered === "view") return "view";
  return "edit";
}

/** Modes this user may pick on this page. */
export function allowedPageModes(input: {
  canEdit: boolean;
  authored: boolean;
  isAuthor: boolean;
  suggestionsAvailable: boolean;
}): PageMode[] {
  if (!input.canEdit) return ["view"];
  const modes: PageMode[] = [];
  if (!input.authored || input.isAuthor) modes.push("edit");
  if (input.suggestionsAvailable) modes.push("suggest");
  modes.push("view");
  return modes;
}
