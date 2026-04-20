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
