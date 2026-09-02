-- 0009: sharing and discovery (Phase 5) — invites, public links,
-- comments, backlinks, and full-text search.

-- ---------------------------------------------------------------------
-- Invites: an owner invites an email address at a role; the invitee
-- accepts while signed in with that address (brief §4/§5).
-- ---------------------------------------------------------------------
create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'editor',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.users (id),
  constraint workspace_invites_role check (role in ('editor', 'viewer'))
);

create unique index workspace_invites_pending_email_idx
  on public.workspace_invites (workspace_id, lower(email))
  where accepted_at is null;

alter table public.workspace_invites enable row level security;

create policy workspace_invites_owner_all on public.workspace_invites
  for all using (public.workspace_role_at_least(workspace_id, 'owner'))
  with check (
    public.workspace_role_at_least(workspace_id, 'owner')
    and invited_by = (select auth.uid())
  );

-- Accepting is a SECURITY DEFINER step (the invitee has no membership
-- yet): the signed-in email must match the invitation.
create function public.accept_invite(p_token text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_invite public.workspace_invites%rowtype;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'sign in to accept an invitation';
  end if;

  select * into v_invite
  from public.workspace_invites
  where token = p_token and accepted_at is null;

  if not found then
    raise exception 'invitation not found or already used';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'invitation has expired';
  end if;
  if lower(v_invite.email) <> v_email then
    raise exception 'this invitation was sent to a different email address';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
  values (v_invite.workspace_id, auth.uid(), v_invite.role, v_invite.invited_by)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  return v_invite.workspace_id;
end;
$$;

revoke execute on function public.accept_invite(text) from public, anon;

-- ---------------------------------------------------------------------
-- Public read-only links (brief §4): one revocable token per page.
-- ---------------------------------------------------------------------
create table public.page_shares (
  page_id uuid primary key references public.pages (id) on delete cascade,
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  public_enabled boolean not null default false,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

alter table public.page_shares enable row level security;

create policy page_shares_editors_all on public.page_shares
  for all using (public.can_edit_page(page_id))
  with check (public.can_edit_page(page_id));

-- Anonymous read of a shared page by token. SECURITY DEFINER because the
-- reader has no membership; returns only the page and its blocks.
create function public.get_public_page(p_token text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'page', jsonb_build_object(
      'id', p.id, 'title', p.title, 'icon', p.icon, 'cover_url', p.cover_url,
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

grant execute on function public.get_public_page(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Comments: page-level thread (brief §5; inline comments are v1.1).
-- ---------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  block_id text, -- v1.1
  author_id uuid not null references public.users (id) on delete cascade,
  body jsonb not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index comments_page_idx on public.comments (page_id, created_at);

alter table public.comments enable row level security;

create policy comments_select on public.comments
  for select using (
    exists (select 1 from public.pages p where p.id = page_id)
  );
create policy comments_insert on public.comments
  for insert with check (
    public.can_edit_page(page_id) and author_id = (select auth.uid())
  );
create policy comments_update on public.comments
  for update using (public.can_edit_page(page_id))
  with check (public.can_edit_page(page_id));
create policy comments_delete on public.comments
  for delete using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.pages p
      where p.id = page_id
        and public.workspace_role_at_least(p.workspace_id, 'owner')
    )
  );

-- ---------------------------------------------------------------------
-- Backlinks (brief §7 page_links): rewritten on every save from the
-- page's link and mention blocks.
-- ---------------------------------------------------------------------
create table public.page_links (
  source_page_id uuid not null references public.pages (id) on delete cascade,
  target_page_id uuid not null references public.pages (id) on delete cascade,
  primary key (source_page_id, target_page_id)
);

create index page_links_target_idx on public.page_links (target_page_id);

alter table public.page_links enable row level security;

create policy page_links_select on public.page_links
  for select using (
    exists (select 1 from public.pages p where p.id = target_page_id)
  );
create policy page_links_insert on public.page_links
  for insert with check (public.can_edit_page(source_page_id));
create policy page_links_delete on public.page_links
  for delete using (public.can_edit_page(source_page_id));

create function public.set_page_links(p_source_page_id uuid, p_target_page_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.page_links where source_page_id = p_source_page_id;
  insert into public.page_links (source_page_id, target_page_id)
  select distinct p_source_page_id, t
  from unnest(p_target_page_ids) as t
  where t <> p_source_page_id
    and exists (select 1 from public.pages p where p.id = t and p.deleted_at is null);
end;
$$;

-- ---------------------------------------------------------------------
-- Search (brief §7): Postgres full-text over title + flattened block text,
-- maintained whenever the blocks projection is replaced.
-- ---------------------------------------------------------------------
alter table public.pages add column search_text text;
alter table public.pages add column search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(search_text, ''))
  ) stored;

create index pages_search_idx on public.pages using gin (search_vector);

create or replace function public.replace_page_blocks(p_page_id uuid, p_blocks jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_text text;
begin
  if jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'p_blocks must be a json array';
  end if;

  delete from public.blocks where page_id = p_page_id;

  insert into public.blocks (id, page_id, parent_block_id, type, position, content, created_by)
  select
    b ->> 'id',
    p_page_id,
    b ->> 'parent_block_id',
    b ->> 'type',
    b ->> 'position',
    coalesce(b -> 'content', '{}'::jsonb),
    auth.uid()
  from jsonb_array_elements(p_blocks) as b;

  -- Every string under a "text" key, anywhere in the block tree.
  select left(string_agg(v #>> '{}', ' '), 200000) into v_text
  from jsonb_path_query(p_blocks, 'lax $.**.text') as v
  where jsonb_typeof(v) = 'string';

  update public.pages
  set updated_at = now(), search_text = v_text
  where id = p_page_id;

  if not found then
    raise exception 'page not found or not editable';
  end if;
end;
$$;

-- Ranked search across every page the caller can see (RLS applies).
create function public.search_pages(p_query text)
returns table (
  id uuid,
  workspace_id uuid,
  title text,
  icon text,
  snippet text,
  rank real
)
language sql stable
set search_path = public
as $$
  select
    p.id,
    p.workspace_id,
    p.title,
    p.icon,
    ts_headline(
      'english',
      coalesce(p.search_text, ''),
      websearch_to_tsquery('english', p_query),
      'MaxWords=24, MinWords=10, MaxFragments=1'
    ),
    ts_rank(p.search_vector, websearch_to_tsquery('english', p_query))
  from public.pages p
  where p.deleted_at is null
    and p.search_vector @@ websearch_to_tsquery('english', p_query)
  order by 6 desc, p.updated_at desc
  limit 25;
$$;

-- rollback:
--   drop function if exists public.search_pages(text);
--   (restore public.replace_page_blocks to its 0006 body)
--   drop index if exists public.pages_search_idx;
--   alter table public.pages drop column if exists search_vector;
--   alter table public.pages drop column if exists search_text;
--   drop function if exists public.set_page_links(uuid, uuid[]);
--   drop table if exists public.page_links;
--   drop table if exists public.comments;
--   drop function if exists public.get_public_page(text);
--   drop table if exists public.page_shares;
--   drop function if exists public.accept_invite(text);
--   drop table if exists public.workspace_invites;
