-- 0027: relation counts the caller's RLS cannot give (Appendix B §4.2,
-- §4.3).
--
-- A link is visible only when both pages are (0025). Two places need to
-- know a link exists without seeing the other page:
--
-- 1. The forward side shows "A page you don't have access to" for each
--    link whose target the viewer cannot see, never the title — the
--    synced-block rule. `relation_link_counts` gives the total per
--    relation row of a page the caller can view; the page route renders
--    total minus visible as placeholders. The reverse side gets nothing:
--    announcing that a page one cannot see links here would say more
--    than the placeholder does.
--
-- 2. The Trash's "Delete permanently" names how many other pages the
--    purge will unlink ("This page is linked from 4 other pages").
--    `relation_pages_linked_outside` counts distinct pages, either
--    direction, outside the set being purged, for a workspace editor.
--
-- Both are SECURITY DEFINER with the caller's rights checked up front and
-- return numbers only.

create function public.relation_link_counts(p_page_id uuid)
returns table (source_property_id text, total bigint)
language sql stable security definer
set search_path = public
as $$
  select r.source_property_id, count(*)::bigint
  from public.page_relations r
  where r.source_page_id = p_page_id
    and exists (
      select 1 from public.pages p
      where p.id = p_page_id
        and public.is_workspace_member(p.workspace_id)
        and (not p.is_private or p.created_by = auth.uid())
    )
  group by r.source_property_id;
$$;

create function public.relation_pages_linked_outside(p_page_ids uuid[])
returns bigint
language sql stable security definer
set search_path = public
as $$
  select count(distinct other)::bigint
  from (
    select r.target_page_id as other, r.workspace_id
    from public.page_relations r
    where r.source_page_id = any (p_page_ids)
      and r.target_page_id <> all (p_page_ids)
    union all
    select r.source_page_id, r.workspace_id
    from public.page_relations r
    where r.target_page_id = any (p_page_ids)
      and r.source_page_id <> all (p_page_ids)
  ) links
  where public.workspace_role_at_least(links.workspace_id, 'editor');
$$;

revoke execute on function public.relation_link_counts(uuid) from public, anon;
revoke execute on function public.relation_pages_linked_outside(uuid[]) from public, anon;

-- rollback:
--   drop function if exists public.relation_pages_linked_outside(uuid[]);
--   drop function if exists public.relation_link_counts(uuid);
