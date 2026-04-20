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
