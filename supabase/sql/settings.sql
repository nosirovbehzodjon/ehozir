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
