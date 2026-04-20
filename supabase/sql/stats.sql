-- ----------------------------------------------------------------------------
-- Group statistics — tiered aggregation (logs → weekly → monthly → yearly).
-- Raw events are appended to `logs`, then pg_cron drains them into aggregates
-- and deletes the raw rows, keeping the logs table small.
-- ----------------------------------------------------------------------------

create table if not exists public.logs (
  id bigserial primary key,
  chat_id bigint not null,
  user_id bigint,
  action_type text not null,     -- message, reaction_given, reaction_received, reply, sticker, voice, media, video_note, gif, link
  created_at timestamptz not null default now()
);

create index if not exists logs_created_at_idx on public.logs (created_at);
create index if not exists logs_chat_id_idx    on public.logs (chat_id);

-- Drop legacy aggregate tables missing user_id — rebuild below with user_id in PK.
-- Safe because aggregate data is derived (logs is authoritative until drained).
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'weekly_stats' and column_name = 'chat_id'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'weekly_stats' and column_name = 'user_id'
  ) then
    drop table if exists public.weekly_stats cascade;
    drop table if exists public.monthly_stats cascade;
    drop table if exists public.yearly_stats cascade;
  end if;
end;
$$;

-- Shared column set for all aggregate tiers. Per (chat, user, period) granularity
-- so monthly/yearly leaderboards and champions can be computed per user.
create table if not exists public.weekly_stats (
  chat_id bigint not null,
  user_id bigint not null,
  period_start date not null,       -- Monday of the ISO week
  messages bigint not null default 0,
  reactions_given bigint not null default 0,
  reactions_received bigint not null default 0,
  replies bigint not null default 0,
  stickers bigint not null default 0,
  voices bigint not null default 0,
  media bigint not null default 0,
  video_notes bigint not null default 0,
  gifs bigint not null default 0,
  links bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (chat_id, user_id, period_start)
);

create index if not exists weekly_stats_period_idx
  on public.weekly_stats (chat_id, period_start);

create table if not exists public.monthly_stats (
  chat_id bigint not null,
  user_id bigint not null,
  period_start date not null,       -- first day of month
  messages bigint not null default 0,
  reactions_given bigint not null default 0,
  reactions_received bigint not null default 0,
  replies bigint not null default 0,
  stickers bigint not null default 0,
  voices bigint not null default 0,
  media bigint not null default 0,
  video_notes bigint not null default 0,
  gifs bigint not null default 0,
  links bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (chat_id, user_id, period_start)
);

create index if not exists monthly_stats_period_idx
  on public.monthly_stats (chat_id, period_start);

create table if not exists public.yearly_stats (
  chat_id bigint not null,
  user_id bigint not null,
  period_start date not null,       -- first day of year
  messages bigint not null default 0,
  reactions_given bigint not null default 0,
  reactions_received bigint not null default 0,
  replies bigint not null default 0,
  stickers bigint not null default 0,
  voices bigint not null default 0,
  media bigint not null default 0,
  video_notes bigint not null default 0,
  gifs bigint not null default 0,
  links bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (chat_id, user_id, period_start)
);

create index if not exists yearly_stats_period_idx
  on public.yearly_stats (chat_id, period_start);

-- Add video_note + gif + link columns to existing aggregate tables (idempotent).
alter table public.weekly_stats  add column if not exists video_notes bigint not null default 0;
alter table public.weekly_stats  add column if not exists gifs        bigint not null default 0;
alter table public.weekly_stats  add column if not exists links       bigint not null default 0;
alter table public.monthly_stats add column if not exists video_notes bigint not null default 0;
alter table public.monthly_stats add column if not exists gifs        bigint not null default 0;
alter table public.monthly_stats add column if not exists links       bigint not null default 0;
alter table public.yearly_stats  add column if not exists video_notes bigint not null default 0;
alter table public.yearly_stats  add column if not exists gifs        bigint not null default 0;
alter table public.yearly_stats  add column if not exists links       bigint not null default 0;

-- ----------------------------------------------------------------------------
-- Aggregation functions.
-- Weekly: drain `logs` → upsert into `weekly_stats`, delete drained rows.
-- RPC: return per-user action counts for a chat since a given timestamp.
-- Pivots counts into one row per user (instead of users x action_types) to
-- stay well under PostgREST's 1000-row default limit.
create or replace function public.get_weekly_action_counts(
  p_chat_id bigint,
  p_since timestamptz
)
returns table (
  user_id bigint,
  messages bigint,
  replies bigint,
  reactions_given bigint,
  reactions_received bigint,
  stickers bigint,
  voices bigint,
  media bigint,
  video_notes bigint,
  gifs bigint,
  links bigint
)
language sql stable
as $$
  select
    l.user_id,
    count(*) filter (where l.action_type = 'message')           as messages,
    count(*) filter (where l.action_type = 'reply')             as replies,
    count(*) filter (where l.action_type = 'reaction_given')    as reactions_given,
    count(*) filter (where l.action_type = 'reaction_received') as reactions_received,
    count(*) filter (where l.action_type = 'sticker')           as stickers,
    count(*) filter (where l.action_type = 'voice')             as voices,
    count(*) filter (where l.action_type = 'media')             as media,
    count(*) filter (where l.action_type = 'video_note')        as video_notes,
    count(*) filter (where l.action_type = 'gif')               as gifs,
    count(*) filter (where l.action_type = 'link')              as links
  from public.logs l
  where l.chat_id = p_chat_id
    and l.created_at >= p_since
    and l.user_id is not null
  group by l.user_id;
$$;

-- Monthly/Yearly: roll up from the previous tier, delete consumed rows of the
-- tier being rolled up (weekly rows older than current month, etc.).
-- All three are atomic: CTE DELETE ... RETURNING feeds an INSERT ... ON CONFLICT.
-- ----------------------------------------------------------------------------

create or replace function public.aggregate_weekly_stats()
returns void
language plpgsql
as $$
begin
  with drained as (
    delete from public.logs
     where created_at < date_trunc('week', now())
       and user_id is not null
     returning chat_id, user_id, action_type, created_at
  ),
  agg as (
    select
      chat_id,
      user_id,
      date_trunc('week', created_at)::date as period_start,
      count(*) filter (where action_type = 'message')            as messages,
      count(*) filter (where action_type = 'reaction_given')     as reactions_given,
      count(*) filter (where action_type = 'reaction_received')  as reactions_received,
      count(*) filter (where action_type = 'reply')              as replies,
      count(*) filter (where action_type = 'sticker')            as stickers,
      count(*) filter (where action_type = 'voice')              as voices,
      count(*) filter (where action_type = 'media')              as media,
      count(*) filter (where action_type = 'video_note')         as video_notes,
      count(*) filter (where action_type = 'gif')                as gifs,
      count(*) filter (where action_type = 'link')               as links
      from drained
      group by chat_id, user_id, date_trunc('week', created_at)
  )
  insert into public.weekly_stats as w
    (chat_id, user_id, period_start, messages, reactions_given, reactions_received,
     replies, stickers, voices, media, video_notes, gifs, links, updated_at)
  select chat_id, user_id, period_start, messages, reactions_given, reactions_received,
         replies, stickers, voices, media, video_notes, gifs, links, now()
    from agg
  on conflict (chat_id, user_id, period_start) do update set
    messages           = w.messages           + excluded.messages,
    reactions_given    = w.reactions_given    + excluded.reactions_given,
    reactions_received = w.reactions_received + excluded.reactions_received,
    replies            = w.replies            + excluded.replies,
    stickers           = w.stickers           + excluded.stickers,
    voices             = w.voices             + excluded.voices,
    media              = w.media              + excluded.media,
    video_notes        = w.video_notes        + excluded.video_notes,
    gifs               = w.gifs               + excluded.gifs,
    links              = w.links              + excluded.links,
    updated_at         = now();
end;
$$;

create or replace function public.aggregate_monthly_stats()
returns void
language plpgsql
as $$
begin
  with drained as (
    delete from public.weekly_stats
     where period_start < date_trunc('month', now())::date
     returning *
  ),
  agg as (
    select
      chat_id,
      user_id,
      date_trunc('month', period_start)::date as period_start,
      sum(messages)           as messages,
      sum(reactions_given)    as reactions_given,
      sum(reactions_received) as reactions_received,
      sum(replies)            as replies,
      sum(stickers)           as stickers,
      sum(voices)             as voices,
      sum(media)              as media,
      sum(video_notes)        as video_notes,
      sum(gifs)               as gifs,
      sum(links)              as links
      from drained
      group by chat_id, user_id, date_trunc('month', period_start)
  )
  insert into public.monthly_stats as m
    (chat_id, user_id, period_start, messages, reactions_given, reactions_received,
     replies, stickers, voices, media, video_notes, gifs, links, updated_at)
  select chat_id, user_id, period_start, messages, reactions_given, reactions_received,
         replies, stickers, voices, media, video_notes, gifs, links, now()
    from agg
  on conflict (chat_id, user_id, period_start) do update set
    messages           = m.messages           + excluded.messages,
    reactions_given    = m.reactions_given    + excluded.reactions_given,
    reactions_received = m.reactions_received + excluded.reactions_received,
    replies            = m.replies            + excluded.replies,
    stickers           = m.stickers           + excluded.stickers,
    voices             = m.voices             + excluded.voices,
    media              = m.media              + excluded.media,
    video_notes        = m.video_notes        + excluded.video_notes,
    gifs               = m.gifs               + excluded.gifs,
    links              = m.links              + excluded.links,
    updated_at         = now();
end;
$$;

create or replace function public.aggregate_yearly_stats()
returns void
language plpgsql
as $$
begin
  with drained as (
    delete from public.monthly_stats
     where period_start < date_trunc('year', now())::date
     returning *
  ),
  agg as (
    select
      chat_id,
      user_id,
      date_trunc('year', period_start)::date as period_start,
      sum(messages)           as messages,
      sum(reactions_given)    as reactions_given,
      sum(reactions_received) as reactions_received,
      sum(replies)            as replies,
      sum(stickers)           as stickers,
      sum(voices)             as voices,
      sum(media)              as media,
      sum(video_notes)        as video_notes,
      sum(gifs)               as gifs,
      sum(links)              as links
      from drained
      group by chat_id, user_id, date_trunc('year', period_start)
  )
  insert into public.yearly_stats as y
    (chat_id, user_id, period_start, messages, reactions_given, reactions_received,
     replies, stickers, voices, media, video_notes, gifs, links, updated_at)
  select chat_id, user_id, period_start, messages, reactions_given, reactions_received,
         replies, stickers, voices, media, video_notes, gifs, links, now()
    from agg
  on conflict (chat_id, user_id, period_start) do update set
    messages           = y.messages           + excluded.messages,
    reactions_given    = y.reactions_given    + excluded.reactions_given,
    reactions_received = y.reactions_received + excluded.reactions_received,
    replies            = y.replies            + excluded.replies,
    stickers           = y.stickers           + excluded.stickers,
    voices             = y.voices             + excluded.voices,
    media              = y.media              + excluded.media,
    video_notes        = y.video_notes        + excluded.video_notes,
    gifs               = y.gifs               + excluded.gifs,
    links              = y.links              + excluded.links,
    updated_at         = now();
end;
$$;
