-- 0031: a template can be installed again after its copy was deleted.
--
-- `synced_blocks` holds one row per (workspace, template_key): the stable
-- key a pack's placements resolve to (Appendix A §1.3 rule 8). Purging a
-- copy's pages from the Trash tombstones its synced blocks, but the
-- tombstone kept its `template_key`. The installer looks only at live
-- blocks, found none, tried to create the keyed blocks afresh and hit the
-- unique index — "That already exists." — so a pack with synced blocks
-- (the CESR Journey) could never be installed in that workspace again.
--
-- A key now belongs to a live block only:
--   * tombstoning releases the key, and existing tombstones are released;
--   * `insert_template_pages` claims each key through
--     `claim_template_synced_key`, which first releases it from a block
--     that is a tombstone or whose source page is in the Trash, and hands
--     the key over only if nothing live still holds it (a live holder the
--     caller cannot see, e.g. on another member's private page, keeps it;
--     the new block is then created without a key rather than failing).

create or replace function public.synced_block_tombstone(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_private boolean;
begin
  select coalesce(p.is_private, false) into v_private
  from public.synced_blocks s
  left join public.pages p on p.id = s.source_page_id
  where s.id = p_id;

  update public.synced_blocks
  set deleted_at = now(),
      source_page_id = null,
      template_key = null,
      ydoc = null,
      blocks = '[]'::jsonb,
      search_text = null,
      title = case when v_private then '' else title end,
      updated_at = now()
  where id = p_id and deleted_at is null;
end;
$$;

update public.synced_blocks
set template_key = null
where template_key is not null
  and (deleted_at is not null or source_page_id is null);

-- The key to give a synced block being created from a template: `p_key`
-- once no live block in the workspace holds it, else null.
create function public.claim_template_synced_key(p_workspace_id uuid, p_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null or p_key = '' then
    return null;
  end if;
  if not public.workspace_role_at_least(p_workspace_id, 'editor') then
    return null;
  end if;

  update public.synced_blocks s
  set template_key = null
  where s.workspace_id = p_workspace_id
    and s.template_key = p_key
    and (
      s.deleted_at is not null
      or s.source_page_id is null
      or exists (
        select 1 from public.pages p
        where p.id = s.source_page_id and p.deleted_at is not null
      )
    );

  if exists (
    select 1 from public.synced_blocks s
    where s.workspace_id = p_workspace_id and s.template_key = p_key
  ) then
    return null;
  end if;
  return p_key;
end;
$$;

revoke execute on function public.claim_template_synced_key(uuid, text) from public, anon;

create or replace function public.insert_template_pages(
  p_pages jsonb,
  p_synced jsonb default '[]'::jsonb,
  p_relations jsonb default '[]'::jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  p jsonb;
  s jsonb;
  r jsonb;
  v_text text;
begin
  if jsonb_typeof(p_pages) <> 'array'
    or jsonb_typeof(p_synced) <> 'array'
    or jsonb_typeof(p_relations) <> 'array' then
    raise exception 'p_pages, p_synced and p_relations must be json arrays';
  end if;

  for p in select * from jsonb_array_elements(p_pages) loop
    insert into public.pages (
      id, workspace_id, parent_page_id, position, title, icon, cover_url,
      description, properties,
      full_width, small_text, authored_content, template_id, template_version,
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
      coalesce((p ->> 'authored_content')::boolean, false),
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
      public.claim_template_synced_key(
        (s ->> 'workspace_id')::uuid, nullif(s ->> 'template_key', '')
      ),
      left(coalesce(s ->> 'title', ''), 200),
      coalesce(s -> 'blocks', '[]'::jsonb),
      v_text,
      auth.uid()
    );
  end loop;

  for p in select * from jsonb_array_elements(p_pages) loop
    perform public.replace_page_blocks((p ->> 'id')::uuid, coalesce(p -> 'blocks', '[]'::jsonb));
  end loop;

  for r in select * from jsonb_array_elements(p_relations) loop
    insert into public.page_relations
      (workspace_id, source_page_id, source_property_id, target_page_id, position, created_by)
    values (
      (r ->> 'workspace_id')::uuid,
      (r ->> 'source_page_id')::uuid,
      r ->> 'source_property_id',
      (r ->> 'target_page_id')::uuid,
      r ->> 'position',
      auth.uid()
    )
    on conflict on constraint page_relations_distinct do nothing;
  end loop;
end;
$$;

-- rollback:
--   (restore public.insert_template_pages(jsonb, jsonb, jsonb) from 0025)
--   drop function if exists public.claim_template_synced_key(uuid, text);
--   (restore public.synced_block_tombstone(uuid) from 0016)
--   (released keys are not restored; nothing reads a tombstone's key)
