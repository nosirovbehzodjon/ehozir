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
