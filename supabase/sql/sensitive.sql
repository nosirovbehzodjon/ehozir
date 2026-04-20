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
