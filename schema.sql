-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- It is idempotent and safe to re-run.

create table if not exists public.groups (
  chat_id bigint primary key,
  title text,
  type text,
  username text,
  member_count integer not null default 0,
  telegram_member_count integer,
  telegram_member_count_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe to re-run on an existing DB that was created before these columns existed:
alter table public.groups
  add column if not exists member_count integer not null default 0;

alter table public.groups
  add column if not exists telegram_member_count integer;

alter table public.groups
  add column if not exists telegram_member_count_updated_at timestamptz;

create table if not exists public.group_members (
  chat_id bigint not null references public.groups(chat_id) on delete cascade,
  user_id bigint not null,
  username text,
  first_name text,
  last_name text,
  is_bot boolean not null default false,
  language_code text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create index if not exists group_members_chat_id_idx
  on public.group_members (chat_id);

-- ----------------------------------------------------------------------------
-- Keep groups.member_count in sync with group_members automatically.
-- Counts only non-bot members (matches what /all and /hamma actually mention).
-- ----------------------------------------------------------------------------

create or replace function public.refresh_group_member_count(p_chat_id bigint)
returns void
language sql
as $$
  update public.groups
     set member_count = (
       select count(*)
         from public.group_members
        where chat_id = p_chat_id
          and is_bot = false
     )
   where chat_id = p_chat_id;
$$;

create or replace function public.group_members_count_trigger()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.refresh_group_member_count(old.chat_id);
    return old;
  else
    perform public.refresh_group_member_count(new.chat_id);
    if (tg_op = 'UPDATE' and old.chat_id <> new.chat_id) then
      perform public.refresh_group_member_count(old.chat_id);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists group_members_count_trg on public.group_members;
create trigger group_members_count_trg
after insert or update or delete on public.group_members
for each row execute function public.group_members_count_trigger();

-- One-time backfill so existing rows get the right count immediately.
update public.groups g
   set member_count = coalesce(sub.cnt, 0)
  from (
    select chat_id, count(*) as cnt
      from public.group_members
     where is_bot = false
     group by chat_id
  ) sub
 where g.chat_id = sub.chat_id;
