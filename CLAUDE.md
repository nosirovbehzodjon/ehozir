# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rule: keep docs and capabilities in sync with code

Any change that adds, removes, or renames a feature, command, DB table/column, env var, or scheduler **must** be accompanied by updates to:

1. `README.md` — commands table, features list, setup notes.
2. `CLAUDE.md` (this file) — project structure, schema, design decisions, commands tables.
3. `src/i18n/translations.ts` — both `greeting` and `capabilitiesFull` strings for **all three languages** (uz/ru/en). These are shown the first time the bot joins a group, so they must always reflect current capabilities.

Treat these updates as part of the same change, not a follow-up. Before declaring a task done, re-read the diff and ask: "did I add/remove/rename anything user-visible? If yes, are README, CLAUDE.md, and both i18n strings updated in all 3 langs?"

## Known Risks (`RISK.md`)

`RISK.md` tracks known performance, scalability, reliability, and data-correctness issues that are not yet fixed. Each risk has a stable numeric ID (e.g. `1.2`, `3.1`), a code location pointer, a `status` (`open` / `fixed`), and an impact note. Risks are grouped by category: PostgREST 1000-row limit, Telegram rate limits, N+1 query patterns, scheduler overlap, silent failures, race conditions, and memory.

When fixing a risk:

1. Flip its row `status` from `open` to `fixed` in `RISK.md` as part of the same change.
2. Keep the ID stable — do not renumber or delete rows, so commits and PRs that reference an ID stay valid.
3. When adding new risks, append to the appropriate category table with the next available ID.

Reference risks by ID in commit messages and PR descriptions (e.g. `fix 3.1: dedupe + batch member+avatar resolution`) so progress against `RISK.md` is easy to audit.

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
    settings.ts           — Group settings, language & feature toggles (all stored in group_settings)
    users.ts              — Bot users table (private-chat users) + invite points: upsertUser, getUser, setUserLanguage, awardInvitePoints (idempotent per user+chat via user_group_invites)
    botSettings.ts        — Bot-wide settings (news hours, global config)
    news.ts               — External news DB functions (insert, click tracking, stats)
    sensitiveLog.ts       — NSFW profile log & check cache (sensitive_profile_log, nsfw_check_log)
    youtubeChannels.ts    — Curated YouTube channel list CRUD (youtube_channels)
    usefulContent.ts      — Useful content pool + click tracking + per-group delivery helpers (useful_content, useful_content_clicks). Includes pickUsefulContentForDelivery (channel round-robin), send-count bumping, prune exhausted/old rows, and getMonthlyUsefulClicksByChannel for /usefulstats. All category-aware (`useful` vs `english`) — english learning content shares the same tables, distinguished by the `category` column. `getGroupsWithFeatureEnabled(feature)` powers both schedulers.
  commands/
    hamma.ts              — /hamma, /all — mention all tracked members (group only)
    random.ts             — /qura, /random, /случайный — pick random member(s) from the group (group only)
    currency.ts           — /kurs, /rate, /курс — show USD, EUR, RUB, CNY exchange rates from CBU (group only)
    stats.ts              — /stats, /statistika, /статистика — tracked vs total member counts (group only)
    help.ts               — /help, /yordam, /помощь — list available commands, categorized (group only)
    news.ts               — /news, /yangiliklar, /новости — enable/disable daily news (group only)
    sensitiveContent.ts   — /sensitive_content, /sensitive_content_off — toggle NSFW scanning (group only, default OFF)
    testNews.ts           — /testNews — send news to current group only (group, developer-only)
    usefulContent.ts      — /foydali, /useful, /полезное — enable/disable daily useful YouTube videos (group). Also /testUseful (dev group), /addChannel /removeChannel /listChannels (dev bot DM)
    englishContent.ts     — /ingliz, /english, /английский — enable/disable daily English learning videos (group). Also /testEnglish (dev group), /addEnglishChannel /removeEnglishChannel /listEnglishChannels /englishstats (dev bot DM)
    language.ts           — /uz, /ru, /en — change group language (group only)
    start.ts              — /start — private-chat onboarding: upserts the user into `users`, shows a 3-button language picker (uz/ru/en) on first run, then a welcome with the user's current points, an inline "Add bot to a group" button (t.me/<bot>?startgroup=true), and a Capabilities button that replies with `capabilitiesFull`. Subsequent /start calls skip the picker.
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
    usefulContent.ts      — Two parallel cron jobs (useful + english) fetch curated YouTube channel uploads and deliver them daily. Useful at `useful_content_hours` (default 10, Tashkent), English at `english_content_hours` (default 16, Tashkent). Both reuse the same core pipeline via a `ContentKind` config; exports `start{Useful,English}ContentScheduler`, `sendDaily{Useful,English}Content`, and `send{Useful,English}ContentToChat`.
    weeklyStats.ts        — Weekly/monthly/yearly leaderboard + champion cards. Exports runStatsNow(period, chatId?), runWeeklyStatsNow(bot, chatId?), runMonthlyStatsNow(bot, chatId?), runYearlyStatsNow(bot, chatId?), and the three start*StatsScheduler functions. Passing a chatId narrows the job to a single group — the `/test*stats [chat_id]` commands use this to avoid running against every group during manual testing. Monthly/yearly runs trigger pg aggregate RPCs before reading the aggregate tables.
    groupClassifier.ts    — Classifies each tracked group as `'group'` or `'discussion'` by checking `linked_chat_id` on the full Chat object (`bot.api.getChat`). Exports classifyGroup(api, chatId), refreshAllGroupKinds(bot), and startGroupClassifierScheduler(bot) which runs Sun 03:00 Tashkent. Greeting handler also calls classifyGroup on join so new groups are classified immediately.
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

- `groups(chat_id PK, title, type, username, member_count, telegram_member_count, telegram_member_count_updated_at, kind, created_at, updated_at)`
  - `member_count` — count of non-bot rows in `group_members`. Maintained by trigger `group_members_count_trg`.
  - `telegram_member_count` / `telegram_member_count_updated_at` — true total from `getChatMemberCount`, refreshed on `/stats`.
  - `kind` — `'group'` or `'discussion'` (nullable). A discussion group is a supergroup linked to a Telegram channel (has `linked_chat_id` on the full Chat object). Populated on bot join and refreshed weekly by `startGroupClassifierScheduler` (Sun 03:00 Tashkent).
- `group_members(chat_id FK->groups, user_id, username, first_name, last_name, is_bot, language_code, first_seen, last_seen, PK(chat_id, user_id))`
  - Index: `group_members_chat_id_idx` on `(chat_id)`
  - Trigger: `group_members_count_trg` -> keeps `groups.member_count` accurate.
- `group_settings(chat_id FK->groups, feature, enabled, value, updated_at, PK(chat_id, feature))` — per-group settings and feature toggles.
  - `feature='dailyNews'` + `enabled=true/false` — toggle daily news delivery.
  - `feature='language'` + `value='uz'/'ru'/'en'` — group language setting.
- `bot_settings(key PK, value, updated_at)` — bot-wide key/value config (e.g. `news_hours`).
- `external_news(id serial PK, source, title, link, external_id, category, published_at, fetched_at)` — news fetched from external APIs.
  - Unique index on `(source, external_id)` for deduplication.
- `external_news_clicks(id serial PK, news_id FK->external_news, chat_id, clicked_at)` — click tracking per news item for partner statistics.
- `youtube_channels(channel_id PK, handle, title, uploads_playlist_id, is_active, added_at, category)` — curated YouTube channel list. `uploads_playlist_id` is cached from `channels.list` so the daily cron only pays 1 quota unit per channel (`playlistItems.list`). `category` is `'useful'` (default) or `'english'` — lets one table back both features.
- `useful_content(id serial PK, video_id unique, channel_id FK->youtube_channels, channel_title, title, thumbnail_url, link, published_at, fetched_at, send_count, category)` — deduped YouTube video pool. `send_count` tracks how many times a row has been broadcast; the scheduler prunes rows when it hits 2, and also prunes anything older than 365 days. `category` mirrors the channel's category so picks/prunes/stats can filter between useful and english pools.
- `useful_content_clicks(id serial PK, content_id FK->useful_content, chat_id, clicked_at)` — click tracking for useful videos.
- `sensitive_profile_log(user_id PK, username, first_name, last_name, reason, category, confidence, detected_in_chat_id, created_at)` — flagged NSFW profiles for cross-group instant banning.
- `nsfw_check_log(user_id PK, checked_at)` — tracks when each user was last NSFW-scanned (24h TTL, production only).
- `users(user_id PK, username, first_name, last_name, language, points, started_at, last_seen)` — bot users who have DM'd `/start`. Separate from `group_members`: these are direct bot users accruing invite points. `points` is bumped by the `increment_user_points(p_user_id, p_delta)` RPC.
- `user_group_invites(user_id, chat_id, points_awarded, created_at, PK(user_id, chat_id))` — one row per (inviter, group). PK uniqueness makes `awardInvitePoints` idempotent — removing and re-adding the bot to the same group does not re-credit the inviter.

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
- **Useful content (YouTube, opt-in per group)**: Daily cron fetches latest uploads from each active row in `youtube_channels` via `playlistItems.list` (1 unit/channel, cheap). New videos are upserted into `useful_content` (deduped by `video_id`), then 10 are picked via `pickUsefulContentForDelivery` and sent to every group with `group_settings.feature='usefulContent'` enabled. Pick rules: only rows with `send_count < 2`, prefer never-sent, round-robin across channels so one prolific channel can't dominate. After each daily send the delivered rows have their `send_count` bumped once; rows that hit `send_count >= 2` are pruned, and any row older than 365 days (by `fetched_at`) is also pruned. Delivery hours are stored in `bot_settings.useful_content_hours` (default `10`, Tashkent), separate from news hours to avoid spam. Click tracking goes through the `yt-redirect` Edge Function; `/usefulstats [YYYY-MM]` aggregates clicks per channel for a given month via `getMonthlyUsefulClicksByChannel`.
- **English learning content (YouTube, opt-in per group)**: Second parallel delivery pipeline that reuses `youtube_channels` / `useful_content` / `useful_content_clicks` via the `category='english'` column — no separate tables. Enabled per group via `/ingliz` `/english` `/английский` (`group_settings.feature='englishContent'`). Managed with `/addEnglishChannel`, `/removeEnglishChannel`, `/listEnglishChannels`, `/testEnglish`. Delivery hours stored in `bot_settings.english_content_hours` (default `16`, Tashkent) so english and useful don't land on the same hour. Stats: `/englishstats [YYYY-MM]`. Click tracking reuses the `yt-redirect` Edge Function (keyed by content id, category-agnostic).
- **YouTube API cost discipline**: Never use `search.list` (100 units) — always resolve channels once via `channels.list` (1 unit) to cache `uploads_playlist_id`, then poll `playlistItems.list` (1 unit) in the cron. With 50 channels that's ~50 units/day against a 10,000/day free quota.
- **Pending channel seed pattern**: `schema.sql` seeds channels with synthetic `pending:@handle` IDs and `uploads_playlist_id='pending'`. On first scheduler run, `resolvePendingChannels()` upgrades each pending row into a real resolved row via `resolveChannel()` and deactivates the placeholder.
- **Command scoping**: Group commands (member mentions, news toggle, language, help) only work in groups. Bot commands (`/settings`, `/newsstats`) only work in private bot chat. `/testNews` works in groups but is developer-only.
- **Categorized help**: `/help` shows commands in categories (group commands, developer group commands, developer bot commands). Developer categories only visible to developers.
- **Unified group_settings table**: All per-group config (feature toggles, language) stored in `group_settings` table. Boolean features use `enabled` column, string settings use `value` column.
- **Dual notification formats**: `notifyDevelopers()` for bot errors, `notifyNsfwBan()` for NSFW bans — separate formats so bans don't look like errors.
- **Bot user onboarding + invite points**: Private-chat `/start` upserts the user into `users`, walks first-timers through a language picker (inline keyboard with callback `start:lang:(uz|ru|en)`), then sends a welcome showing current points and an inline "Add bot to a group" button built from `https://t.me/<botUsername>?startgroup=true` (Telegram's native add-to-group modal — no env var needed, username comes from `ctx.me`). When the bot is subsequently added to a group, `registerGreeting`'s `my_chat_member` handler calls `awardInvitePoints(inviter, chat, 10)` and DMs the inviter a confirmation in their saved language. The unique row in `user_group_invites` guarantees each (user, chat) pair is credited at most once. Points are for a future gift/redemption system — no redemption logic yet.
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
| `/news_off` | `/yangiliklar_bekor` | `/отмена_новостей` | Disable daily news |
| `/useful` | `/foydali` | `/полезное` | Enable daily useful YouTube videos |
| `/useful_off` | `/foydali_bekor` | `/отмена_полезного` | Disable daily useful videos |
| `/english` | `/ingliz` | `/английский` | Enable daily English learning videos |
| `/english_off` | `/ingliz_bekor` | `/отмена_английского` | Disable daily English learning videos |
| `/sensitive_content` | — | — | Enable NSFW scanning (default off) |
| `/sensitive_content_off` | — | — | Disable NSFW scanning |
| `/uz` | — | — | Set group language to Uzbek |
| `/ru` | — | — | Set group language to Russian |
| `/en` | — | — | Set group language to English |
| `/random` | `/qura` | `/случайный` | Pick random member(s) from the group (`/random 3` picks 3) |
| `/rate` | `/kurs` | `/курс` | Show exchange rates — USD, EUR, RUB, CNY from Central Bank of Uzbekistan |

### Developer-only group commands

| Command | Description |
|---------|-------------|
| `/testNews` | Send news to current group immediately |
| `/testUseful` | Send useful YouTube videos to current group immediately |
| `/testEnglish` | Send English learning videos to current group immediately |
| `/testweeklystats [chat_id]` | Run weekly leaderboard job now (bot DM). With a chat id, runs only for that group; without, runs for all groups |
| `/testmonthlystats [chat_id]` | Run monthly leaderboard job now (bot DM). Optional chat id targets a single group |
| `/testyearlystats [chat_id]` | Run yearly leaderboard job now (bot DM). Optional chat id targets a single group |

### Private-chat commands (available to everyone in bot DM)

| Command | Description |
|---------|-------------|
| `/start` | Onboards a bot user: picks a language on first run, then shows current invite points and an inline "Add bot to a group" button. Adding the bot to a new group awards the inviter 10 points (toward a future gift system). |

### Developer-only bot commands (private chat only)

| Command | Description |
|---------|-------------|
| `/settings` | Configure daily news delivery times via inline keyboard |
| `/newsstats` | View news click statistics (summary or per source) |
| `/usefulstats [YYYY-MM]` | View useful-content click statistics per channel for a given month (default: current) |
| `/englishstats [YYYY-MM]` | View English-learning click statistics per channel for a given month |
| `/addChannel <url\|@handle\|UC...>` | Add a YouTube channel to the useful-content list |
| `/removeChannel <channel_id>` | Deactivate a useful-content YouTube channel |
| `/listChannels` | Show all configured useful-content YouTube channels |
| `/addEnglishChannel <url\|@handle\|UC...>` | Add a YouTube channel to the English-learning list |
| `/removeEnglishChannel <channel_id>` | Deactivate an English-learning YouTube channel |
| `/listEnglishChannels` | Show all configured English-learning YouTube channels |

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
