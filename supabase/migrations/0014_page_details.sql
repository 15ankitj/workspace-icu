-- 0014: page details — description, last editor, and a bounded set of
-- per-page properties.
--
-- The concept brief keeps databases, views and relations for v2. This is
-- the v1-safe subset: a one-line description under the title, "who edited
-- last" beside "who created", and a small jsonb block of properties a page
-- can show or hide (people, date, select, link, text). Everything is
-- additive and the jsonb shape is designed to lift into v2 database rows.

alter table public.pages
  add column description text not null default '',
  add column updated_by uuid references public.users(id) on delete set null,
  add column properties jsonb not null default '{"hidden":[],"rows":[]}'::jsonb;

alter table public.pages
  add constraint pages_description_length check (char_length(description) <= 500),
  add constraint pages_properties_shape check (
    jsonb_typeof(properties) = 'object'
    and jsonb_typeof(properties -> 'rows') = 'array'
    and jsonb_typeof(properties -> 'hidden') = 'array'
    and pg_column_size(properties) <= 32768
  );

-- Pages record who edited them last, alongside when. The generic
-- set_updated_at trigger stays for other tables; pages get their own.
create function public.set_page_updated()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated
  before update on public.pages
  for each row execute function public.set_page_updated();

-- Backfill: until someone edits, the creator is the last editor.
update public.pages set updated_by = created_by where updated_by is null;

-- Public share view carries the description.
create or replace function public.get_public_page(p_token text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'page', jsonb_build_object(
      'id', p.id, 'title', p.title, 'icon', p.icon, 'cover_url', p.cover_url,
      'description', p.description,
      'full_width', p.full_width, 'small_text', p.small_text,
      'updated_at', p.updated_at
    ),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'parent_block_id', b.parent_block_id, 'type', b.type,
        'position', b.position, 'content', b.content
      ))
      from public.blocks b where b.page_id = p.id
    ), '[]'::jsonb)
  )
  from public.page_shares s
  join public.pages p on p.id = s.page_id
  where s.public_token = p_token
    and s.public_enabled
    and p.deleted_at is null;
$$;

-- Template instantiation copies the description and the property rows
-- (with people and dates cleared by the snapshot builder).
create or replace function public.insert_template_pages(p_pages jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  p jsonb;
begin
  if jsonb_typeof(p_pages) <> 'array' then
    raise exception 'p_pages must be a json array';
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
    perform public.replace_page_blocks(
      (p ->> 'id')::uuid,
      coalesce(p -> 'blocks', '[]'::jsonb)
    );
  end loop;
end;
$$;

-- rollback:
--   (restore insert_template_pages and get_public_page from 0010 / 0009)
--   drop trigger if exists pages_set_updated on public.pages;
--   create trigger pages_set_updated_at before update on public.pages
--     for each row execute function public.set_updated_at();
--   drop function if exists public.set_page_updated();
--   alter table public.pages drop constraint if exists pages_properties_shape;
--   alter table public.pages drop constraint if exists pages_description_length;
--   alter table public.pages drop column if exists properties;
--   alter table public.pages drop column if exists updated_by;
--   alter table public.pages drop column if exists description;
