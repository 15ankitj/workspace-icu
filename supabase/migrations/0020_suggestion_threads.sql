-- 0020: suggestion threads, notifications and the digest opt-out
-- (Appendix A, Part 2, slice 2).
--
-- A suggestion's rationale is a comment thread anchored to it — the
-- existing comment model, one system not two (brief §2.5). Notifications
-- are rows written by triggers: a new suggestion notifies the page's
-- authors, a resolution notifies the suggester, a reply notifies everyone
-- on the thread. They feed the in-app badge and a daily email digest,
-- which each user can switch off.

alter table public.comments add column suggestion_id text;
alter table public.comments
  add constraint comments_suggestion_fkey
  foreign key (page_id, suggestion_id)
  references public.page_suggestions (page_id, id) on delete cascade;
create index comments_suggestion_idx
  on public.comments (page_id, suggestion_id) where suggestion_id is not null;

alter table public.users add column email_digest boolean not null default true;
comment on column public.users.email_digest is
  'Daily email digest of suggestion activity (opt-out in account settings).';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  suggestion_id text,
  kind text not null,
  actor_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  emailed_at timestamptz,
  constraint notifications_kind check (kind in (
    'suggestion_created', 'suggestion_accepted', 'suggestion_rejected',
    'suggestion_withdrawn', 'suggestion_reply'
  ))
);

create index notifications_unread_idx
  on public.notifications (user_id, workspace_id) where read_at is null;
create index notifications_digest_idx
  on public.notifications (user_id, created_at) where emailed_at is null;

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select using (user_id = (select auth.uid()));
-- Writes come from triggers and mark_notifications_read() only.

-- The page's authors: creator plus named co-authors.
create function public.page_authors(p_page_id uuid)
returns uuid[]
language sql stable security definer
set search_path = public
as $$
  select array_prepend(p.created_by, p.co_authors) from public.pages p where p.id = p_page_id;
$$;

-- Notify members among the recipients, never the actor, and never twice
-- while an identical notification is still unread.
create function public.notify_users(
  p_recipients uuid[],
  p_workspace uuid,
  p_page uuid,
  p_suggestion text,
  p_kind text,
  p_actor uuid
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, workspace_id, page_id, suggestion_id, kind, actor_id)
  select distinct r, p_workspace, p_page, p_suggestion, p_kind, p_actor
  from unnest(coalesce(p_recipients, '{}'::uuid[])) as r
  where r is not null
    and r is distinct from p_actor
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = p_workspace and m.user_id = r
    )
    and not exists (
      select 1 from public.notifications n
      where n.user_id = r and n.page_id = p_page
        and n.suggestion_id is not distinct from p_suggestion
        and n.kind = p_kind and n.read_at is null
    );
end;
$$;

create function public.notify_suggestion_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.pages where id = new.page_id;
  if tg_op = 'INSERT' then
    perform public.notify_users(
      public.page_authors(new.page_id), v_ws, new.page_id, new.id,
      'suggestion_created', new.suggester_id
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status <> 'open' then
    if new.status = 'withdrawn' then
      perform public.notify_users(
        public.page_authors(new.page_id), v_ws, new.page_id, new.id,
        'suggestion_withdrawn', new.suggester_id
      );
    else
      perform public.notify_users(
        array[new.suggester_id], v_ws, new.page_id, new.id,
        'suggestion_' || new.status, new.resolved_by
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger page_suggestions_notify
  after insert or update of status on public.page_suggestions
  for each row execute function public.notify_suggestion_change();

create function public.notify_suggestion_reply()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_suggester uuid;
  v_recipients uuid[];
begin
  if new.suggestion_id is null then
    return new;
  end if;
  select workspace_id into v_ws from public.pages where id = new.page_id;
  select suggester_id into v_suggester
  from public.page_suggestions
  where page_id = new.page_id and id = new.suggestion_id;
  select array_agg(distinct u) into v_recipients from (
    select unnest(public.page_authors(new.page_id)) as u
    union select v_suggester
    union select c.author_id from public.comments c
      where c.page_id = new.page_id and c.suggestion_id = new.suggestion_id
  ) x;
  perform public.notify_users(
    v_recipients, v_ws, new.page_id, new.suggestion_id,
    'suggestion_reply', new.author_id
  );
  return new;
end;
$$;

create trigger comments_notify_suggestion
  after insert on public.comments
  for each row execute function public.notify_suggestion_reply();

create function public.mark_notifications_read(p_workspace_id uuid default null)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_workspace_id is null or workspace_id = p_workspace_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.set_email_digest(p_enabled boolean)
returns void
language sql security definer
set search_path = public
as $$
  update public.users set email_digest = p_enabled where id = auth.uid();
$$;

revoke execute on function public.page_authors(uuid) from public, anon, authenticated;
revoke execute on function public.notify_users(uuid[], uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.mark_notifications_read(uuid) from public, anon;
revoke execute on function public.set_email_digest(boolean) from public, anon;

-- rollback:
--   drop function if exists public.set_email_digest(boolean);
--   drop function if exists public.mark_notifications_read(uuid);
--   drop trigger if exists comments_notify_suggestion on public.comments;
--   drop function if exists public.notify_suggestion_reply();
--   drop trigger if exists page_suggestions_notify on public.page_suggestions;
--   drop function if exists public.notify_suggestion_change();
--   drop function if exists public.notify_users(uuid[], uuid, uuid, text, text, uuid);
--   drop function if exists public.page_authors(uuid);
--   drop policy if exists notifications_select_own on public.notifications;
--   drop table if exists public.notifications;
--   alter table public.users drop column if exists email_digest;
--   alter table public.comments drop constraint if exists comments_suggestion_fkey;
--   alter table public.comments drop column if exists suggestion_id;
