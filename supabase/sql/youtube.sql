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
