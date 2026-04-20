-- ----------------------------------------------------------------------------
-- Pending NSFW bans — admin-approval flow. When a newly detected NSFW account
-- is found in a group, the bot creates a row here instead of banning directly
-- and DMs each admin of the group (who has started the bot in DM) with an
-- Approve/Reject inline keyboard. The first admin to decide wins.
-- Rows auto-expire after 48 hours with no decision.
-- Users already in sensitive_profile_log skip this flow and are banned
-- instantly cross-group.
-- ----------------------------------------------------------------------------

create table if not exists public.pending_nsfw_bans (
  id bigserial primary key,
  user_id bigint not null,
  chat_id bigint not null,
  username text,
  first_name text,
  last_name text,
  reason text not null,              -- profile_photo | channel_photo | message_photo | reaction
  category text not null,            -- Porn | Hentai | Sexy
  confidence real not null,
  message_id bigint,                 -- offending message to delete on approve
  reaction_message_id bigint,        -- message the user reacted to (to repost-and-delete)
  group_title text,
  admin_notifications jsonb not null default '[]'::jsonb,
  -- ^ array of { admin_id: bigint, message_id: bigint } — DMs to edit on resolve
  status text not null default 'pending',  -- pending | approved | rejected | expired
  resolved_by bigint,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only one pending ban per (chat, user) — prevents duplicate admin DMs if the
-- same user triggers detection repeatedly while a decision is still pending.
create unique index if not exists pending_nsfw_bans_chat_user_pending_idx
  on public.pending_nsfw_bans (chat_id, user_id)
  where status = 'pending';

create index if not exists pending_nsfw_bans_status_idx
  on public.pending_nsfw_bans (status);

create index if not exists pending_nsfw_bans_created_at_idx
  on public.pending_nsfw_bans (created_at);
