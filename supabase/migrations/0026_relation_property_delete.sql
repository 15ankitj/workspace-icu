-- 0026: deleting a relation property removes all its links (Appendix B
-- §4.1 rule 5).
--
-- The row belongs to the source page, so its editor may drop the whole
-- relation — including links whose target they could not edit one by one
-- (a private page of another member, say), which the page_relations
-- delete policy would leave behind as orphans. SECURITY DEFINER with the
-- source-page check up front; the audit trigger still writes one
-- relation.link_removed per link under the caller's uid.

create function public.delete_relation_property(p_page_id uuid, p_property_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.can_edit_page(p_page_id) then
    raise exception 'not allowed to edit this page';
  end if;
  with gone as (
    delete from public.page_relations
    where source_page_id = p_page_id and source_property_id = p_property_id
    returning id
  )
  select count(*) into v_count from gone;
  return v_count;
end;
$$;

revoke execute on function public.delete_relation_property(uuid, text) from public, anon;

-- rollback:
--   drop function if exists public.delete_relation_property(uuid, text);
