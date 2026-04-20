-- ============================================================================
-- GENERATED FILE — do not edit by hand.
-- Source partials live in supabase/sql/*.sql; run `npm run build:schema` to
-- regenerate this file after editing them. The Supabase workflow (paste this
-- file into the SQL Editor) is unchanged — this file is the artifact, not
-- the source of truth.
-- ============================================================================

-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- It is idempotent and safe to re-run.

-- >>> supabase/sql/groups.sql
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

-- Legacy: language column migrated to group_settings
alter table public.groups
  add column if not exists language text not null default 'uz';

-- Group vs discussion-group classification. Populated on bot join and
-- refreshed weekly by startGroupClassifierScheduler. Null = not yet
-- classified (older groups added before this column existed).
alter table public.groups
  add column if not exists kind text
  check (kind is null or kind in ('group', 'discussion'));

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

-- >>> supabase/sql/settings.sql
-- ----------------------------------------------------------------------------
-- Legacy commands registry — removed. /help reads from src/i18n/translations.ts,
-- which is the single source of truth for the command list.
-- ----------------------------------------------------------------------------

drop table if exists public.commands cascade;

-- ----------------------------------------------------------------------------
-- Per-group feature settings — toggles for current and future features.
-- Each row is one feature toggle for one group.
-- ----------------------------------------------------------------------------

create table if not exists public.group_settings (
  chat_id bigint not null references public.groups(chat_id) on delete cascade,
  feature text not null,
  enabled boolean not null default true,
  value text,                    -- for settings that need a string value (e.g. language)
  updated_at timestamptz not null default now(),
  primary key (chat_id, feature)
);

alter table public.group_settings
  add column if not exists value text;

create index if not exists group_settings_chat_id_idx
  on public.group_settings (chat_id);

-- Migrate language from groups.language to group_settings
insert into public.group_settings (chat_id, feature, enabled, value, updated_at)
  select chat_id, 'language', true, language, now()
  from public.groups
  where language is not null and language <> 'uz'
on conflict (chat_id, feature) do nothing;

-- ----------------------------------------------------------------------------
-- Bot-wide settings — key/value store for global bot configuration.
-- Used for things like daily news hour, timezone, etc.
-- ----------------------------------------------------------------------------

create table if not exists public.bot_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Default news hours: 11:00 and 19:00 Tashkent time
insert into public.bot_settings (key, value) values
  ('news_hours', '11,19')
on conflict (key) do nothing;

-- >>> supabase/sql/external_news.sql
-- Drop legacy news tables (replaced by external_news)
drop table if exists public.news_clicks;
drop table if exists public.news;

-- ----------------------------------------------------------------------------
-- External news — fetched from kun.uz and daryo.uz APIs.
-- ----------------------------------------------------------------------------

create table if not exists public.external_news (
  id serial primary key,
  source text not null,            -- 'kun' or 'daryo'
  title text not null,
  link text not null,
  external_id text not null,       -- slug or href from the source API
  category text,
  published_at timestamptz,
  fetched_at timestamptz not null default now()
);

-- Prevent duplicate articles from the same source
create unique index if not exists external_news_source_external_id_uniq
  on public.external_news (source, external_id);

create index if not exists external_news_fetched_at_idx
  on public.external_news (fetched_at desc);

-- ----------------------------------------------------------------------------
-- External news click tracking — counts clicks for partner statistics.
-- ----------------------------------------------------------------------------

create table if not exists public.external_news_clicks (
  id serial primary key,
  news_id integer not null references public.external_news(id) on delete cascade,
  chat_id bigint,
  clicked_at timestamptz not null default now()
);

create index if not exists external_news_clicks_news_id_idx
  on public.external_news_clicks (news_id);

-- >>> supabase/sql/sensitive.sql
-- ----------------------------------------------------------------------------
-- Sensitive profile log — flagged NSFW profiles for cross-group recognition.
-- When a user is detected as NSFW in one group, they can be instantly banned
-- in any other group without re-scanning.
-- ----------------------------------------------------------------------------

create table if not exists public.sensitive_profile_log (
  user_id bigint primary key,
  username text,
  first_name text,
  last_name text,
  reason text not null,       -- 'profile_photo', 'channel_photo', 'message_photo'
  category text not null,     -- 'Porn', 'Hentai', 'Sexy'
  confidence real not null,
  detected_in_chat_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists sensitive_profile_log_created_at_idx
  on public.sensitive_profile_log (created_at);

-- ----------------------------------------------------------------------------
-- NSFW profile check log — tracks when each user was last scanned so the bot
-- doesn't re-download and re-classify on every single message.
-- Only used in production (NODE_ENV=production); in development every message
-- triggers a fresh scan for easier testing.
-- ----------------------------------------------------------------------------

create table if not exists public.nsfw_check_log (
  user_id bigint primary key,
  checked_at timestamptz not null default now()
);

-- >>> supabase/sql/message_authors.sql
-- ----------------------------------------------------------------------------
-- Message authors — remembers who wrote each message so reaction_received
-- can be attributed to the right user. Telegram's message_reaction update
-- does not include the author of the reacted-to message, so we record it
-- at send time and look it up on reaction. Rows older than 30 days are
-- purged by pg_cron (see pg_cron.sql) — reactions on older messages are rare.
-- ----------------------------------------------------------------------------

create table if not exists public.message_authors (
  chat_id bigint not null,
  message_id bigint not null,
  user_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (chat_id, message_id)
);

create index if not exists message_authors_created_at_idx
  on public.message_authors (created_at);

-- >>> supabase/sql/pending_cards.sql
-- ----------------------------------------------------------------------------
-- Pending weekly cards — cron uploads rendered cards to the developer DM
-- and stores the returned Telegram file_ids here. On approve, the bot
-- re-sends the same file_ids to the target group (Telegram allows reuse),
-- avoiding a second render.
-- ----------------------------------------------------------------------------

create table if not exists public.pending_weekly_cards (
  id serial primary key,
  chat_id bigint not null,
  leaderboard_file_id text,
  champion_file_id text,
  silver_file_id text,
  bronze_file_id text,
  top_ten_file_id text,
  caption text,
  period text not null default 'week',       -- week | month | year
  status text not null default 'pending',    -- pending | approved | rejected
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table public.pending_weekly_cards
  add column if not exists period text not null default 'week';

alter table public.pending_weekly_cards
  add column if not exists silver_file_id text;

alter table public.pending_weekly_cards
  add column if not exists bronze_file_id text;

alter table public.pending_weekly_cards
  add column if not exists top_ten_file_id text;

create index if not exists pending_weekly_cards_status_idx
  on public.pending_weekly_cards (status);

-- >>> supabase/sql/stats.sql
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

-- >>> supabase/sql/youtube.sql
-- ----------------------------------------------------------------------------
-- YouTube useful content — curated channels + deduped video pool + click log.
-- Daily cron fetches latest uploads from each active channel via YouTube Data
-- API v3 (playlistItems.list on the channel's uploads playlist, 1 unit/call).
-- ----------------------------------------------------------------------------

create table if not exists public.youtube_channels (
  channel_id text primary key,            -- UC... YouTube channel id
  handle text,                            -- @handle (may be null)
  title text not null,
  uploads_playlist_id text not null,      -- cached to avoid channels.list on every run
  is_active boolean not null default true,
  added_at timestamptz not null default now()
);

create table if not exists public.useful_content (
  id serial primary key,
  video_id text not null unique,          -- YouTube video id
  channel_id text not null references public.youtube_channels(channel_id) on delete cascade,
  channel_title text not null,
  title text not null,
  thumbnail_url text,
  link text not null,                     -- https://www.youtube.com/watch?v=...
  published_at timestamptz,
  fetched_at timestamptz not null default now()
);

create index if not exists useful_content_fetched_at_idx
  on public.useful_content (fetched_at desc);

create index if not exists useful_content_channel_id_idx
  on public.useful_content (channel_id);

-- Track how many times each video has been delivered. Videos that hit
-- send_count >= 2 are pruned by the scheduler, so we never spam a group
-- with the same clip more than twice.
alter table public.useful_content
  add column if not exists send_count integer not null default 0;

create index if not exists useful_content_send_count_idx
  on public.useful_content (send_count, published_at desc);

-- Bump send_count for a batch of useful_content rows in one round trip,
-- called by the scheduler after every delivery. Created with `or replace`
-- so re-running this schema upgrades older installs cleanly.
create or replace function public.increment_useful_content_sent(p_ids bigint[])
returns void
language sql
as $$
  update public.useful_content
     set send_count = send_count + 1
   where id = any(p_ids);
$$;

create table if not exists public.useful_content_clicks (
  id serial primary key,
  content_id integer not null references public.useful_content(id) on delete cascade,
  chat_id bigint,
  clicked_at timestamptz not null default now()
);

create index if not exists useful_content_clicks_content_id_idx
  on public.useful_content_clicks (content_id);

-- Default delivery hours: 10:00 Tashkent time (separate from news hours).
-- Multi-hour like news_hours — comma-separated list configurable via /settings.
insert into public.bot_settings (key, value) values
  ('useful_content_hours', '10')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- English learning content — same tables as useful content, distinguished by
-- `category` column. Seeded default delivery hour is 16:00 Tashkent, separate
-- from news and useful content to avoid spam.
-- ----------------------------------------------------------------------------

alter table public.youtube_channels
  add column if not exists category text not null default 'useful';

alter table public.useful_content
  add column if not exists category text not null default 'useful';

create index if not exists youtube_channels_category_active_idx
  on public.youtube_channels (category, is_active);

create index if not exists useful_content_category_idx
  on public.useful_content (category, send_count, published_at desc);

insert into public.bot_settings (key, value) values
  ('english_content_hours', '16')
on conflict (key) do nothing;

-- Seed the initial curated channels. uploads_playlist_id is a placeholder;
-- the bot resolves it on first run via /addChannel or auto-resolves in the
-- scheduler. Rows are kept even if placeholder so dev can see them in /listChannels.
insert into public.youtube_channels (channel_id, handle, title, uploads_playlist_id, is_active) values
  ('pending:@Alohidamavzu',  '@Alohidamavzu',  'Alohida mavzu',   'pending', true),
  ('pending:@RanoMuminovaa', '@RanoMuminovaa', 'Rano Muminova',   'pending', true),
  ('pending:@bintusodiq',    '@bintusodiq',    'Bintu Sodiq',     'pending', true)
on conflict (channel_id) do nothing;

-- >>> supabase/sql/users.sql
-- ----------------------------------------------------------------------------
-- Bot users — people who have started a private chat with the bot.
-- Separate from group_members: these are users who interact with the bot
-- directly (via /start in DM) and accrue invite points for adding the bot
-- to groups. Points power a future gift/reward system.
-- ----------------------------------------------------------------------------

create table if not exists public.users (
  user_id bigint primary key,
  username text,
  first_name text,
  last_name text,
  language text not null default 'uz',
  points integer not null default 0,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- Invite log — one row per (inviter, chat) so we never double-award points
-- when the bot is removed and re-added to the same group by the same user.
create table if not exists public.user_group_invites (
  user_id bigint not null,
  chat_id bigint not null,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, chat_id)
);

create index if not exists user_group_invites_user_id_idx
  on public.user_group_invites (user_id);

create or replace function public.increment_user_points(p_user_id bigint, p_delta integer)
returns void
language sql
as $$
  update public.users
     set points = points + p_delta
   where user_id = p_user_id;
$$;

-- >>> supabase/sql/rls.sql
-- ----------------------------------------------------------------------------
-- Row Level Security — defense in depth.
-- The bot uses the service_role key which bypasses RLS entirely, so enabling
-- RLS does not affect bot behavior. It protects against accidental exposure
-- via the anon/public key (e.g. if an Edge Function or future client ever
-- connects with it). With RLS enabled and no policies defined, the anon role
-- has zero access while service_role keeps full access.
-- ----------------------------------------------------------------------------

alter table public.groups                enable row level security;
alter table public.group_members         enable row level security;
alter table public.group_settings        enable row level security;
alter table public.bot_settings          enable row level security;
alter table public.external_news         enable row level security;
alter table public.external_news_clicks  enable row level security;
alter table public.sensitive_profile_log enable row level security;
alter table public.nsfw_check_log        enable row level security;
alter table public.message_authors       enable row level security;
alter table public.pending_weekly_cards  enable row level security;
alter table public.logs                  enable row level security;
alter table public.weekly_stats          enable row level security;
alter table public.monthly_stats         enable row level security;
alter table public.yearly_stats          enable row level security;
alter table public.youtube_channels      enable row level security;
alter table public.useful_content        enable row level security;
alter table public.useful_content_clicks enable row level security;
alter table public.users                 enable row level security;
alter table public.user_group_invites    enable row level security;

-- >>> supabase/sql/pg_cron.sql
-- ----------------------------------------------------------------------------
-- pg_cron schedule — runs inside Postgres, survives bot restarts.
-- Enable the extension (Supabase: Database → Extensions → enable pg_cron).
-- Must be loaded last: all referenced aggregate functions need to exist first.
-- ----------------------------------------------------------------------------

create extension if not exists pg_cron;

-- Drop existing jobs before re-creating (idempotent re-run).
do $$
begin
  perform cron.unschedule(jobid)
    from cron.job
   where jobname in ('aggregate_weekly_stats',
                     'aggregate_monthly_stats',
                     'aggregate_yearly_stats',
                     'purge_message_authors');
end;
$$;

-- Weekly: every Monday at 00:05 UTC
select cron.schedule('aggregate_weekly_stats',  '5 0 * * 1', $$select public.aggregate_weekly_stats();$$);
-- Monthly: 1st of month at 00:15 UTC
select cron.schedule('aggregate_monthly_stats', '15 0 1 * *', $$select public.aggregate_monthly_stats();$$);
-- Yearly: Jan 1 at 00:30 UTC
select cron.schedule('aggregate_yearly_stats',  '30 0 1 1 *', $$select public.aggregate_yearly_stats();$$);
-- Daily at 03:00 UTC: drop message_authors rows older than 7 days
select cron.schedule('purge_message_authors',   '0 3 * * *', $$delete from public.message_authors where created_at < now() - interval '7 days';$$);

