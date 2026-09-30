"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  fail,
  fromSupabaseError,
  ok,
  runAction,
  type ActionFailure,
  type ActionResult,
} from "@/lib/action-result";
import { comparePositions, firstPosition, positionAfter } from "@/lib/position";
import {
  MAX_RELATION_LINKS,
  MAX_ROWS,
  normalizeProperties,
  propertyId as newPropertyId,
  type PagePropertyRow,
} from "@/lib/page-properties";
import { relationRowByLabel, type RelationRow } from "@/lib/relations";
import type { Json } from "@/lib/database.types";

/**
 * Relation links (Appendix B §4.1). Every write goes through the caller's
 * RLS: adding needs edit rights on both pages, removing on both with the
 * trash ignored, and the database's own checks (same workspace, live
 * pages, declared row, 200 per property) are the last word. The audit
 * events are written by trigger.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROPERTY_ID = /^[A-Za-z0-9_-]{1,40}$/;
const POSITION = /^[0-9A-Za-z]{1,200}$/;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

/** Turn a refused write into something a person can act on. */
function explain(error: { message: string; code?: string }): ActionFailure {
  const m = error.message;
  if (error.code === "42501" || /row-level security/i.test(m)) {
    return fail(
      "You need edit access to both pages to change this link.",
      "permission_denied",
    );
  }
  if (/same workspace/.test(m)) {
    return fail("Relations link pages in the same workspace only.");
  }
  if (/in the trash/.test(m)) {
    return fail("A page in the trash cannot be linked. Restore it first.");
  }
  if (/at most 200/.test(m)) {
    return fail(`A relation holds at most ${MAX_RELATION_LINKS} pages.`);
  }
  if (/no relation property/.test(m)) {
    return fail("That relation no longer exists on the page.");
  }
  if (error.code === "23505") {
    return fail("That page is already linked.", "conflict");
  }
  return fromSupabaseError(error);
}

/** The failure for a malformed id, or null when every id is well formed. */
function checkIds(...pairs: [unknown, RegExp][]): ActionFailure | null {
  for (const [value, pattern] of pairs) {
    if (typeof value !== "string" || !pattern.test(value)) {
      return fail("Invalid request");
    }
  }
  return null;
}

async function insertLink(
  supabase: Supabase,
  userId: string,
  workspaceId: string,
  sourcePageId: string,
  propertyId: string,
  targetPageId: string,
): Promise<ActionResult<{ id: string; position: string }>> {
  const { data: existing, error: loadError } = await supabase
    .from("page_relations")
    .select("position, target_page_id")
    .eq("source_page_id", sourcePageId)
    .eq("source_property_id", propertyId);
  if (loadError) return explain(loadError);
  const links = existing ?? [];
  if (links.some((l) => l.target_page_id === targetPageId)) {
    return fail("That page is already linked.", "conflict");
  }
  if (links.length >= MAX_RELATION_LINKS) {
    return fail(`A relation holds at most ${MAX_RELATION_LINKS} pages.`);
  }
  // Ordered here, not in SQL: fractional keys sort by code point, which
  // the database collation need not agree with.
  const last = links
    .map((l) => l.position)
    .sort(comparePositions)
    .at(-1);
  const position = last ? positionAfter(last) : firstPosition();

  const { data, error } = await supabase
    .from("page_relations")
    .insert({
      workspace_id: workspaceId,
      source_page_id: sourcePageId,
      source_property_id: propertyId,
      target_page_id: targetPageId,
      position,
      created_by: userId,
    })
    .select("id, position")
    .single();
  if (error) return explain(error);
  return ok(data);
}

function revalidatePages(workspaceId: string, ...pageIds: string[]) {
  for (const id of pageIds) revalidatePath(`/w/${workspaceId}/p/${id}`);
}

/** Forward side: add `targetPageId` to a relation row of `sourcePageId`. */
export async function addRelationLink(
  sourcePageId: string,
  propertyId: string,
  targetPageId: string,
): Promise<ActionResult<{ id: string; position: string }>> {
  return runAction(async () => {
    const invalid = checkIds(
      [sourcePageId, UUID],
      [propertyId, PROPERTY_ID],
      [targetPageId, UUID],
    );
    if (invalid) return invalid;
    if (sourcePageId === targetPageId) {
      return fail("A page cannot be linked to itself.");
    }
    const { supabase, user } = await requireUser();
    const { data: page } = await supabase
      .from("pages")
      .select("workspace_id, properties")
      .eq("id", sourcePageId)
      .maybeSingle();
    if (!page) return fail("Page not found");
    const row = normalizeProperties(page.properties).rows.find(
      (r) => r.id === propertyId && r.type === "relation",
    );
    if (!row) return fail("That relation no longer exists on the page.");

    const link = await insertLink(
      supabase,
      user.id,
      page.workspace_id,
      sourcePageId,
      propertyId,
      targetPageId,
    );
    if (!link.ok) return link;
    revalidatePages(page.workspace_id, sourcePageId, targetPageId);
    return ok({ id: link.id, position: link.position });
  });
}

/**
 * Reverse side (§4.1 rule 4): from the target page, add `sourcePageId`
 * under the connection called `label` / `reverseLabel`. The source page
 * gets a relation row with that label if it has none; the link is then
 * an ordinary forward link from it.
 */
export async function addRelationFromReverse(
  targetPageId: string,
  sourcePageId: string,
  label: string,
  reverseLabel: string,
): Promise<ActionResult<{ id: string; position: string; propertyId: string }>> {
  return runAction(async () => {
    const invalid = checkIds([targetPageId, UUID], [sourcePageId, UUID]);
    if (invalid) return invalid;
    if (typeof label !== "string" || !label.trim()) {
      return fail("Invalid request");
    }
    if (sourcePageId === targetPageId) {
      return fail("A page cannot be linked to itself.");
    }
    const { supabase, user } = await requireUser();
    const { data: source } = await supabase
      .from("pages")
      .select("workspace_id, properties")
      .eq("id", sourcePageId)
      .maybeSingle();
    if (!source) return fail("Page not found");

    const properties = normalizeProperties(source.properties);
    let row: RelationRow | null = relationRowByLabel(properties, label);
    if (!row) {
      if (properties.rows.length >= MAX_ROWS) {
        return fail("That page already has the maximum number of properties.");
      }
      const candidate: PagePropertyRow = {
        id: newPropertyId(),
        type: "relation",
        label,
        reverse_label: reverseLabel,
      };
      const next = normalizeProperties({
        hidden: properties.hidden,
        rows: [...properties.rows, candidate],
      });
      const added = next.rows.find((r) => r.id === candidate.id);
      if (!added || added.type !== "relation") {
        return fail("Could not add the relation to that page.");
      }
      const { error } = await supabase
        .from("pages")
        .update({ properties: next as unknown as Json })
        .eq("id", sourcePageId);
      if (error) return explain(error);
      row = added;
    }

    const link = await insertLink(
      supabase,
      user.id,
      source.workspace_id,
      sourcePageId,
      row.id,
      targetPageId,
    );
    if (!link.ok) return link;
    revalidatePages(source.workspace_id, sourcePageId, targetPageId);
    return ok({ id: link.id, position: link.position, propertyId: row.id });
  });
}

/** Remove a link from either side. */
export async function removeRelationLink(
  linkId: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const invalid = checkIds([linkId, UUID]);
    if (invalid) return invalid;
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("page_relations")
      .delete()
      .eq("id", linkId)
      .select("workspace_id, source_page_id, target_page_id");
    if (error) return explain(error);
    const gone = data?.[0];
    if (!gone) {
      return fail(
        "The link was not removed: it is already gone, or you need edit access to both pages.",
      );
    }
    revalidatePages(
      gone.workspace_id,
      gone.source_page_id,
      gone.target_page_id,
    );
    return ok();
  });
}

/** Reorder within a property: the client computes the fractional key. */
export async function moveRelationLink(
  linkId: string,
  position: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const invalid = checkIds([linkId, UUID], [position, POSITION]);
    if (invalid) return invalid;
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("page_relations")
      .update({ position })
      .eq("id", linkId)
      .select("workspace_id, source_page_id");
    if (error) return explain(error);
    const moved = data?.[0];
    if (!moved) {
      return fail(
        "The link was not moved: it is gone, or you need edit access to the page.",
      );
    }
    revalidatePages(moved.workspace_id, moved.source_page_id);
    return ok();
  });
}
