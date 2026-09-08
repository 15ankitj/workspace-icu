/**
 * The daily suggestion digest (Appendix A §2.5): one email per person,
 * grouped by workspace and page, counts per kind. Pure so the cron route
 * and the tests share it. No page content beyond titles ever appears.
 */

export type NotificationKind =
  | "suggestion_created"
  | "suggestion_accepted"
  | "suggestion_rejected"
  | "suggestion_withdrawn"
  | "suggestion_reply"
  | "suggestion_stale";

export interface DigestRow {
  workspaceId: string;
  workspaceName: string;
  pageId: string;
  pageTitle: string;
  kind: NotificationKind;
  actorName: string | null;
}

export interface DigestPage {
  pageId: string;
  pageTitle: string;
  counts: Partial<Record<NotificationKind, number>>;
  actors: string[];
  total: number;
}

export interface DigestWorkspace {
  workspaceId: string;
  workspaceName: string;
  pages: DigestPage[];
  total: number;
}

/** Group notifications for one recipient into workspaces and pages. */
export function buildDigest(rows: DigestRow[]): DigestWorkspace[] {
  const workspaces = new Map<string, DigestWorkspace>();
  for (const row of rows) {
    let ws = workspaces.get(row.workspaceId);
    if (!ws) {
      ws = {
        workspaceId: row.workspaceId,
        workspaceName: row.workspaceName,
        pages: [],
        total: 0,
      };
      workspaces.set(row.workspaceId, ws);
    }
    let page = ws.pages.find((p) => p.pageId === row.pageId);
    if (!page) {
      page = {
        pageId: row.pageId,
        pageTitle: row.pageTitle,
        counts: {},
        actors: [],
        total: 0,
      };
      ws.pages.push(page);
    }
    page.counts[row.kind] = (page.counts[row.kind] ?? 0) + 1;
    page.total += 1;
    ws.total += 1;
    if (row.actorName && !page.actors.includes(row.actorName)) {
      page.actors.push(row.actorName);
    }
  }
  const out = [...workspaces.values()];
  out.sort((a, b) => a.workspaceName.localeCompare(b.workspaceName));
  for (const ws of out) {
    ws.pages.sort(
      (a, b) => b.total - a.total || a.pageTitle.localeCompare(b.pageTitle),
    );
  }
  return out;
}

const LABELS: Record<NotificationKind, [string, string]> = {
  suggestion_created: ["new suggestion", "new suggestions"],
  suggestion_accepted: ["suggestion accepted", "suggestions accepted"],
  suggestion_rejected: ["suggestion rejected", "suggestions rejected"],
  suggestion_withdrawn: ["suggestion withdrawn", "suggestions withdrawn"],
  suggestion_reply: ["reply", "replies"],
  suggestion_stale: [
    "suggestion no longer applies",
    "suggestions no longer apply",
  ],
};

const ORDER: NotificationKind[] = [
  "suggestion_created",
  "suggestion_reply",
  "suggestion_accepted",
  "suggestion_rejected",
  "suggestion_withdrawn",
  "suggestion_stale",
];

/** "2 new suggestions, 1 reply" */
export function describeCounts(
  counts: Partial<Record<NotificationKind, number>>,
): string {
  return ORDER.filter((kind) => (counts[kind] ?? 0) > 0)
    .map((kind) => {
      const n = counts[kind]!;
      return `${n} ${LABELS[kind][n === 1 ? 0 : 1]}`;
    })
    .join(", ");
}

/** One line per notification kind, for the in-app updates list. */
export function describeNotification(
  kind: NotificationKind,
  actorName: string | null,
): string {
  const who = actorName ?? "Someone";
  switch (kind) {
    case "suggestion_created":
      return `${who} suggested a change`;
    case "suggestion_accepted":
      return `${who} accepted your suggestion`;
    case "suggestion_rejected":
      return `${who} rejected your suggestion`;
    case "suggestion_withdrawn":
      return `${who} withdrew a suggestion`;
    case "suggestion_reply":
      return `${who} replied on a suggestion`;
    case "suggestion_stale":
      return `${who} changed the text under your suggestion — it no longer applies`;
  }
}

export function digestSubject(total: number): string {
  return `${total} suggestion update${total === 1 ? "" : "s"} on WorkspaceICU`;
}
