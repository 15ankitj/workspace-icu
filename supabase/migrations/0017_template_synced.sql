-- 0017: template instantiation carries synced blocks (Appendix A §1.3
-- rule 8). `insert_template_pages` gains `p_synced`: rows to create in
-- `synced_blocks` (with their stable `template_key`) before the pages'
-- blocks are written, so placements resolve and `synced_embeds` fills.
-- Order matters: pages first (sources must exist), then synced blocks
-- (RLS: editable source page), then blocks (embeds need the rows).

drop function if exists public.insert_template_pages(jsonb);

create function public.insert_template_pages(p_pages jsonb, p_synced jsonb default '[]'::jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  p jsonb;
  s jsonb;
  v_text text;
begin
  if jsonb_typeof(p_pages) <> 'array' or jsonb_typeof(p_synced) <> 'array' then
    raise exception 'p_pages and p_synced must be json arrays';
  end if;

  for p in select * from jsonb_array_elements(p_pages) loop
    insert into public.pages (
      id, workspace_id, parent_page_id, position, title, icon, cover_url,
      description, properties,
      full_width, small_text, template_id, template_version,
      template_page_key, created_by
    ) values (
      (p ->> 'id')::uuid,
      (p ->> 'workspace_id')::uuid,
      nullif(p ->> 'parent_page_id', '')::uuid,
      p ->> 'position',
      coalesce(p ->> 'title', ''),
      p ->> 'icon',
      p ->> 'cover_url',
      coalesce(p ->> 'description', ''),
      case
        when jsonb_typeof(p -> 'properties') = 'object' then p -> 'properties'
        else '{"hidden":[],"rows":[]}'::jsonb
      end,
      coalesce((p ->> 'full_width')::boolean, false),
      coalesce((p ->> 'small_text')::boolean, false),
      nullif(p ->> 'template_id', '')::uuid,
      nullif(p ->> 'template_version', '')::int,
      p ->> 'template_page_key',
      auth.uid()
    );
  end loop;

  for s in select * from jsonb_array_elements(p_synced) loop
    select left(string_agg(v #>> '{}', ' '), 200000) into v_text
    from jsonb_path_query(coalesce(s -> 'blocks', '[]'::jsonb), 'lax $.**.text') as v
    where jsonb_typeof(v) = 'string';

    insert into public.synced_blocks
      (id, workspace_id, source_page_id, template_key, title, blocks, search_text, created_by)
    values (
      (s ->> 'id')::uuid,
      (s ->> 'workspace_id')::uuid,
      (s ->> 'source_page_id')::uuid,
      nullif(s ->> 'template_key', ''),
      left(coalesce(s ->> 'title', ''), 200),
      coalesce(s -> 'blocks', '[]'::jsonb),
      v_text,
      auth.uid()
    );
  end loop;

  for p in select * from jsonb_array_elements(p_pages) loop
    perform public.replace_page_blocks(
      (p ->> 'id')::uuid,
      coalesce(p -> 'blocks', '[]'::jsonb)
    );
  end loop;
end;
$$;

revoke execute on function public.insert_template_pages(jsonb, jsonb) from public, anon;

-- rollback:
--   drop function if exists public.insert_template_pages(jsonb, jsonb);
--   (restore public.insert_template_pages(jsonb) from 0014)
