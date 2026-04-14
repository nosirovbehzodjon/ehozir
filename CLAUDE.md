# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rule: keep docs and capabilities in sync with code

Any change that adds, removes, or renames a feature, command, DB table/column, env var, or scheduler **must** be accompanied by updates to:

1. `README.md` — commands table, features list, setup notes.
2. `CLAUDE.md` (this file) — project structure, schema, design decisions, commands tables.
3. `src/i18n/translations.ts` — both `greeting` and `capabilitiesFull` strings for **all three languages** (uz/ru/en). These are shown the first time the bot joins a group, so they must always reflect current capabilities.

Treat these updates as part of the same change, not a follow-up. Before declaring a task done, re-read the diff and ask: "did I add/remove/rename anything user-visible? If yes, are README, CLAUDE.md, and both i18n strings updated in all 3 langs?"

## Project Overview

A multi-feature Telegram bot (TypeScript + grammY) for Uzbek community groups. Core features: member mentions, daily news delivery from external sources (daryo.uz), multi-language support (uz/ru/en), and automatic NSFW protection using machine learning. Data is persisted to Supabase Postgres.

## Common Commands

- **Start the bot (development):** `npm run dev`
- **Start the bot (production):** `npm run build && npm start`
- **Typecheck:** `npm run typecheck`
- **Install dependencies:** `npm install`
- **Deploy edge functions:** `npm run deploy:functions`

## Architecture

### Project Structure

```
src/
  bot.ts                  — Entry point: creates bot, registers middleware + commands, starts polling
  db/
    client.ts             — Supabase client init (service-role, no session persistence)
    groups.ts             — Groups & members DB functions (upsert, query, stats)
    commands.ts           — Commands table queries (getActiveCommands)
    settings.ts           — Group settings, language & feature toggles (all stored in group_settings)
    botSettings.ts        — Bot-wide settings (news hours, global config)
    news.ts               — External news DB functions (insert, click tracking, stats)
    sensitiveLog.ts       — NSFW profile log & check cache (sensitive_profile_log, nsfw_check_log)
    youtubeChannels.ts    — Curated YouTube channel list CRUD (youtube_channels)
    usefulContent.ts      — Useful content pool + click tracking + per-group delivery helpers (useful_content, useful_content_clicks). Includes pickUsefulContentForDelivery (channel round-robin), send-count bumping, prune exhausted/old rows, and getMonthlyUsefulClicksByChannel for /usefulstats.
  commands/
    hamma.ts              — /hamma, /all — mention all tracked members (group only)
    stats.ts              — /stats, /statistika, /статистика — tracked vs total member counts (group only)
    help.ts               — /help, /yordam, /помощь — list available commands, categorized (group only)
    news.ts               — /news, /yangiliklar, /новости — enable/disable daily news (group only)
    sensitiveContent.ts   — /sensitive_content, /sensitive_content_off — toggle NSFW scanning (group only, default OFF)
    testNews.ts           — /testNews — send news to current group only (group, developer-only)
    usefulContent.ts      — /foydali, /useful, /полезное — enable/disable daily useful YouTube videos (group). Also /testUseful (dev group), /addChannel /removeChannel /listChannels (dev bot DM)
    language.ts           — /uz, /ru, /en — change group language (group only)
    settings.ts           — /settings — configure news delivery times via inline keyboard (bot chat, developer-only)
    newsStats.ts          — /newsstats — news click statistics per source (bot chat, developer-only)
  middleware/
    tracker.ts            — Member tracking (messages, new_chat_members, chat_member updates)
    nsfw.ts               — NSFW protection (profile photos, channel photos, message photos, reactions)
  services/
    nsfw.ts               — NSFWJS model loader, image classification, Telegram file download
    newsFetcher.ts        — Fetch latest news from daryo.uz API
    youtube.ts            — YouTube Data API v3 client: resolveChannel (channels.list) + fetchLatestUploads (playlistItems.list on uploads playlist)
  scheduler/
    dailyNews.ts          — Cron job sends news at multiple configurable hours (Tashkent timezone)
    usefulContent.ts      — Cron job fetches curated YouTube channel uploads and delivers 5 newest videos daily at useful_content_hour (Tashkent)
    weeklyStats.ts        — Weekly/monthly/yearly leaderboard + champion cards. Exports runStatsNow(period), runWeeklyStatsNow, runMonthlyStatsNow, runYearlyStatsNow, and the three start*StatsScheduler functions. Monthly/yearly runs trigger pg aggregate RPCs before reading the aggregate tables.
  i18n/
    translations.ts       — All translations (uz/ru/en) with type-safe Translation type
    index.ts              — t(lang) helper, onCommand() for Latin + Cyrillic command aliases
  utils/
    markdown.ts           — escapeMarkdown helper
    notify.ts             — notifyDevelopers() for errors, notifyNsfwBan() for NSFW bans
supabase/
  functions/
    redirect/index.ts     — Edge Function: tracks external news clicks in DB, then 302 redirects to actual URL
    yt-redirect/index.ts  — Edge Function: tracks useful_content clicks in DB, then 302 redirects to YouTube video URL
```

**Adding a new command:** Create a file in `src/commands/`, export a `registerXxx(bot)` function, import and call it in `bot.ts`. Add translations to `src/i18n/translations.ts` for all 3 languages.

**Adding a new feature:** Create DB helpers in `src/db/`, use `group_settings` table for per-group toggles/settings or `bot_settings` for global config.

**Adding a new news source:** Add a new fetcher function in `src/services/newsFetcher.ts` with a unique `source` value (e.g. `"kun"`). The stats and click tracking automatically pick up any source from the `external_news` table.

### Schema (schema.sql)

Idempotent DDL for Supabase tables. Re-run any time the schema changes — all statements use `if not exists` / `add column if not exists` / `create or replace`.

### Database Schema (Supabase / Postgres)

- `groups(chat_id PK, title, type, username, member_count, telegram_member_count, telegram_member_count_updated_at, created_at, updated_at)`
  - `member_count` — count of non-bot rows in `group_members`. Maintained by trigger `group_members_count_trg`.
  - `telegram_member_count` / `telegram_member_count_updated_at` — true total from `getChatMemberCount`, refreshed on `/stats`.
- `group_members(chat_id FK->groups, user_id, username, first_name, last_name, is_bot, language_code, first_seen, last_seen, PK(chat_id, user_id))`
  - Index: `group_members_chat_id_idx` on `(chat_id)`
  - Trigger: `group_members_count_trg` -> keeps `groups.member_count` accurate.
- `commands(name PK, description, usage, is_active, created_at)` — command registry (legacy, `/help` now reads from i18n translations).
- `group_settings(chat_id FK->groups, feature, enabled, value, updated_at, PK(chat_id, feature))` — per-group settings and feature toggles.
  - `feature='dailyNews'` + `enabled=true/false` — toggle daily news delivery.
  - `feature='language'` + `value='uz'/'ru'/'en'` — group language setting.
- `bot_settings(key PK, value, updated_at)` — bot-wide key/value config (e.g. `news_hours`).
- `external_news(id serial PK, source, title, link, external_id, category, published_at, fetched_at)` — news fetched from external APIs.
  - Unique index on `(source, external_id)` for deduplication.
- `external_news_clicks(id serial PK, news_id FK->external_news, chat_id, clicked_at)` — click tracking per news item for partner statistics.
- `youtube_channels(channel_id PK, handle, title, uploads_playlist_id, is_active, added_at)` — curated YouTube channel list. `uploads_playlist_id` is cached from `channels.list` so the daily cron only pays 1 quota unit per channel (`playlistItems.list`).
- `useful_content(id serial PK, video_id unique, channel_id FK->youtube_channels, channel_title, title, thumbnail_url, link, published_at, fetched_at, send_count)` — deduped YouTube video pool. `send_count` tracks how many times a row has been broadcast; the scheduler prunes rows when it hits 2, and also prunes anything older than 365 days.
- `useful_content_clicks(id serial PK, content_id FK->useful_content, chat_id, clicked_at)` — click tracking for useful videos.
- `sensitive_profile_log(user_id PK, username, first_name, last_name, reason, category, confidence, detected_in_chat_id, created_at)` — flagged NSFW profiles for cross-group instant banning.
- `nsfw_check_log(user_id PK, checked_at)` — tracks when each user was last NSFW-scanned (24h TTL, production only).

### Key Design Decisions

- **Persistent storage via Supabase**: Per-group member lists live in Postgres, keyed by `chat_id`. Safe to restart and to deploy across many groups.
- **Service role key**: The bot is a trusted backend, so it uses the `service_role` key and bypasses RLS. Never expose this key client-side.
- **Multi-language (i18n)**: All user-facing messages are translated to Uzbek, Russian, and English. Commands have per-language aliases (e.g. `/help` = `/yordam` = `/помощь`). Cyrillic commands use `bot.hears()` with regex since `bot.command()` only supports Latin.
- **Multi-source member tracking**: Members are captured from messages, `new_chat_members`, and `chat_member` status updates. The `chat_member` source requires admin rights.
- **`allowed_updates` opt-in**: `chat_member`, `my_chat_member`, `message_reaction`, and `callback_query` must be listed in `bot.start()`.
- **NSFW protection (opt-in per group, default OFF)**: Uses NSFWJS (TensorFlow.js pure JS) to classify images. Checks profile photos, personal channel photos, message photos, and reaction senders. Thresholds: Porn/Hentai/Sexy > 40%. Enabled per group via `/sensitive_content` (stored as `group_settings.feature='nsfwCheck'`). All three NSFW middleware handlers early-return if the feature is disabled for the chat.
- **Cross-group NSFW recognition**: Flagged users are logged to `sensitive_profile_log`. If detected in one group, they're instantly banned in any other group without re-scanning.
- **NSFW check caching**: In production, each user is only scanned once per 24h (persisted in `nsfw_check_log`). In development, every message triggers a fresh scan for testing.
- **Developer exemption**: Developers (from `DEVELOPER_IDS`) are never banned — they receive a text notification instead. Message photo classifications show full category percentages to developers.
- **Reaction handling**: When an NSFW user reacts to a post, their reaction can't be removed via API. Instead, the original post is deleted and re-posted by the bot with attribution mentioning the original author.
- **External news from APIs**: News is fetched live from daryo.uz API (8 articles per delivery). Stored in `external_news` table for click tracking. New sources can be added by creating a new fetcher with a unique `source` value.
- **Multiple news delivery times**: News hours stored as comma-separated list in `bot_settings` (e.g. `"11,19"`). Scheduler runs hourly and checks if current Tashkent hour is in the list. Configurable via `/settings` multi-toggle keyboard.
- **News click tracking via Edge Function**: Links point to a Supabase Edge Function that records clicks in `external_news_clicks` and 302 redirects to the actual article URL.
- **Timezone-aware scheduling**: Cron runs in `Asia/Tashkent` timezone to match Uzbekistan local time.
- **Useful content (YouTube, opt-in per group)**: Daily cron fetches latest uploads from each active row in `youtube_channels` via `playlistItems.list` (1 unit/channel, cheap). New videos are upserted into `useful_content` (deduped by `video_id`), then 10 are picked via `pickUsefulContentForDelivery` and sent to every group with `group_settings.feature='usefulContent'` enabled. Pick rules: only rows with `send_count < 2`, prefer never-sent, round-robin across channels so one prolific channel can't dominate. After each daily send the delivered rows have their `send_count` bumped once; rows that hit `send_count >= 2` are pruned, and any row older than 365 days (by `fetched_at`) is also pruned. Delivery hour is stored in `bot_settings.useful_content_hour` (default `10`, Tashkent), separate from news hours to avoid spam. Click tracking goes through the `yt-redirect` Edge Function; `/usefulstats [YYYY-MM]` aggregates clicks per channel for a given month via `getMonthlyUsefulClicksByChannel`.
- **YouTube API cost discipline**: Never use `search.list` (100 units) — always resolve channels once via `channels.list` (1 unit) to cache `uploads_playlist_id`, then poll `playlistItems.list` (1 unit) in the cron. With 50 channels that's ~50 units/day against a 10,000/day free quota.
- **Pending channel seed pattern**: `schema.sql` seeds channels with synthetic `pending:@handle` IDs and `uploads_playlist_id='pending'`. On first scheduler run, `resolvePendingChannels()` upgrades each pending row into a real resolved row via `resolveChannel()` and deactivates the placeholder.
- **Command scoping**: Group commands (member mentions, news toggle, language, help) only work in groups. Bot commands (`/settings`, `/newsstats`) only work in private bot chat. `/testNews` works in groups but is developer-only.
- **Categorized help**: `/help` shows commands in categories (group commands, developer group commands, developer bot commands). Developer categories only visible to developers.
- **Unified group_settings table**: All per-group config (feature toggles, language) stored in `group_settings` table. Boolean features use `enabled` column, string settings use `value` column.
- **Dual notification formats**: `notifyDevelopers()` for bot errors, `notifyNsfwBan()` for NSFW bans — separate formats so bans don't look like errors.
- **Path aliases**: `@/*` maps to `src/*` via tsconfig paths. Production build uses `tsc-alias`.

## Environment Setup

Required environment variables in `.env`:

- `TELEGRAM_BOT_TOKEN` — bot token from @BotFather
- `SUPABASE_URL` — Supabase project URL (e.g. `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key from Project Settings -> API
- `DEVELOPER_IDS` — comma-separated Telegram user IDs for developer-only commands and NSFW exemption
- `GOOGLE_API_KEY` — YouTube Data API v3 key (required for the useful content feature)
- `NODE_ENV` — set to `production` in production (enables NSFW check caching)

The bot exits on startup if the first three are missing.

**Database setup:** Open Supabase Dashboard -> SQL Editor -> paste `schema.sql` -> Run. The script is idempotent.

**Edge Function deployment:** `npm run deploy:functions`

## Commands

### Group commands (available to all users)

Each command has aliases in Uzbek, Russian, and English:

| English | Uzbek | Russian | Description |
|---------|-------|---------|-------------|
| `/all` | `/hamma` | — | Mention all tracked non-bot members |
| `/stats` | `/statistika` | `/статистика` | Show tracked vs total member counts |
| `/help` | `/yordam` | `/помощь` | List available commands (in group language) |
| `/news` | `/yangiliklar` | `/новости` | Enable daily news for this group |
| `/cancelNews` | `/yangiliklar_bekor` | `/отмена_новостей` | Disable daily news |
| `/useful` | `/foydali` | `/полезное` | Enable daily useful YouTube videos |
| `/useful_off` | `/foydali_bekor` | `/отмена_полезного` | Disable daily useful videos |
| `/sensitive_content` | — | — | Enable NSFW scanning (default off) |
| `/sensitive_content_off` | — | — | Disable NSFW scanning |
| `/uz` | — | — | Set group language to Uzbek |
| `/ru` | — | — | Set group language to Russian |
| `/en` | — | — | Set group language to English |

### Developer-only group commands

| Command | Description |
|---------|-------------|
| `/testNews` | Send news to current group immediately |
| `/testUseful` | Send useful YouTube videos to current group immediately |
| `/testweeklystats` | Run weekly leaderboard job now (bot DM) |
| `/testmonthlystats` | Run monthly leaderboard job now (bot DM) |
| `/testyearlystats` | Run yearly leaderboard job now (bot DM) |

### Developer-only bot commands (private chat only)

| Command | Description |
|---------|-------------|
| `/settings` | Configure daily news delivery times via inline keyboard |
| `/newsstats` | View news click statistics (summary or per source) |
| `/usefulstats [YYYY-MM]` | View useful-content click statistics per channel for a given month (default: current) |
| `/addChannel <url\|@handle\|UC...>` | Add a YouTube channel to the curated list |
| `/removeChannel <channel_id>` | Deactivate a YouTube channel |
| `/listChannels` | Show all configured YouTube channels |

## NSFW Protection

The bot automatically detects and bans users with NSFW content:

- **Profile photos**: Checked when a user sends any message (cached 24h in production)
- **Personal channel photos**: User's linked Telegram channel photo is also checked
- **Message photos**: Every photo sent in the group is classified in real-time
- **Reactions**: When a user reacts to a message, their profile is checked
- **Cross-group**: Flagged users are instantly banned in all groups without re-scanning
- **Developer mode**: Developers see classification percentages for message photos, are never banned

Classification uses NSFWJS with 5 categories (Neutral, Drawing, Sexy, Hentai, Porn). Ban threshold: 40% for Sexy, Hentai, or Porn.

## News System

Daily news is fetched from external APIs and delivered to subscribed groups:

- **Source**: daryo.uz (8 latest non-ad articles per delivery)
- **Schedule**: Multiple times per day (default 11:00 and 19:00 Tashkent time), configurable via `/settings`
- **Click tracking**: Each news link goes through a Supabase Edge Function that records clicks before redirecting
- **Statistics**: `/newsstats` shows per-source click stats, `/newsstats daryo` shows detailed per-article stats
- **Adding sources**: Create a new fetcher in `src/services/newsFetcher.ts` with a unique `source` value. Stats and tracking work automatically.

## Dependencies

- `grammy` — Telegram Bot API framework (TypeScript-first)
- `@supabase/supabase-js` — Supabase client for Postgres access
- `node-cron` — Cron scheduling for daily news
- `nsfwjs` — Pre-trained NSFW image classifier
- `@tensorflow/tfjs` — TensorFlow.js (pure JS, no native deps)
- `jpeg-js` — JPEG image decoding for NSFW classification
- `pngjs` — PNG image decoding for NSFW classification
- `typescript`, `tsx`, `tsc-alias`, `@types/node` (dev) — TypeScript tooling

## Important Limitations

- **Limited member discovery**: Members who existed before the bot joined and never interact will not be tracked.
- **`chat_member` requires admin**: Without admin rights, joins via invite link are not captured.
- **Mentions don't push-notify**: MarkdownV2 user links are clickable but silent.
- **No rate limiting / batching**: Very large groups may exceed Telegram message limits.
- **NSFW model load time**: ~1-3s at startup, stays in memory after that.
- **External API dependency**: News delivery depends on daryo.uz API availability. Fetch failures are logged and skipped gracefully.
