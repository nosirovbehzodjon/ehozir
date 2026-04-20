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
