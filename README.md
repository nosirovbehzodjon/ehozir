# E-Hozir Bot

A multi-feature Telegram bot for Uzbek community groups built with TypeScript and grammY.

## Features

### Member Mentions
- Track group members automatically as they send messages, join, or get added
- Mention all tracked members with `/hamma` or `/all`
- View member statistics with `/stats`

### Multi-Language Support
- Full support for Uzbek, Russian, and English
- All commands and messages are translated
- Commands work in all languages (e.g. `/help` = `/yordam` = `/помощь`)
- Per-group language setting with `/uz`, `/ru`, `/en`

### Daily News
- Fetches latest news from daryo.uz automatically
- Delivers 8 articles per send to subscribed groups
- Multiple delivery times per day (default 11:00 and 19:00 Tashkent time)
- Enable/disable per group with `/news` and `/cancelNews`
- Click tracking via Supabase Edge Function for partner statistics
- Configurable delivery times via `/settings` (developer-only, bot chat)
- Per-source click statistics via `/newsstats` (developer-only, bot chat)

### Useful Content (YouTube)
- Fetches latest videos from a curated list of YouTube channels via YouTube Data API v3
- Delivers 10 videos per day to subscribed groups
- Deduplicated by video ID — same video is never sent twice
- Each video is broadcast at most twice, then pruned (`send_count` cap)
- Picks are spread across channels (round-robin), so a single channel can't fill a slate
- Rows older than 365 days are auto-pruned
- Enable/disable per group with `/foydali` / `/useful` / `/полезное`
- Configurable delivery hour (default 10:00 Tashkent time, separate from news)
- Click tracking via Supabase Edge Function
- Per-channel monthly click stats via `/usefulstats [YYYY-MM]` (developer-only, bot chat)
- Developer commands: `/addChannel`, `/removeChannel`, `/listChannels`, `/testUseful`

### NSFW Protection
- Automatic detection and banning of users with sensitive content
- Checks profile photos, personal channel photos, and message photos
- Scans profile of users who react to messages
- Cross-group recognition: flagged in one group = instant ban in all groups
- Uses NSFWJS machine learning model (TensorFlow.js)
- Always active, no configuration needed

### Developer Tools
- `/testNews` — send news to current group immediately (group only)
- `/settings` — configure news delivery times with inline keyboard (bot chat only)
- `/newsstats` — view news click statistics per source (bot chat only)
- Full NSFW classification breakdown shown for message photos
- Developers are exempt from NSFW bans (receive notification instead)
- Error and ban notifications sent via Telegram DM

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Bot Framework**: [grammY](https://grammy.dev/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **ML**: [NSFWJS](https://github.com/infinitered/nsfwjs) + TensorFlow.js
- **News**: daryo.uz API
- **Deployment**: Railway

## Setup

### Prerequisites

- Node.js 18+
- A Telegram bot token from [@BotFather](https://t.me/botfather)
- A Supabase project

### Installation

```bash
git clone <repo-url>
cd e-hozir
npm install
```

### Environment Variables

Create a `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DEVELOPER_IDS=123456789,987654321
GOOGLE_API_KEY=your_youtube_data_api_v3_key
NODE_ENV=production
```

### Database Setup

Open Supabase Dashboard -> SQL Editor -> paste the contents of `schema.sql` -> Run.

The script is idempotent and safe to re-run whenever the schema changes.

### Edge Function

Deploy the news click tracking function:

```bash
npm run deploy:functions
```

### Running

**Development** (with auto-reload):

```bash
npm run dev
```

**Production**:

```bash
npm run build && npm start
```

### Bot Configuration

1. Set bot privacy mode to **disabled** via @BotFather (`/setprivacy` -> Disable) so the bot can track all messages
2. Make the bot an **admin** in groups so it can ban users, delete messages, and track `chat_member` events

## Commands

### Group commands (all users)

| English | Uzbek | Russian | Description |
|---------|-------|---------|-------------|
| `/all` | `/hamma` | — | Mention all tracked members |
| `/stats` | `/statistika` | `/статистика` | Member count statistics |
| `/help` | `/yordam` | `/помощь` | List available commands |
| `/news` | `/yangiliklar` | `/новости` | Enable daily news |
| `/cancelNews` | `/yangiliklar_bekor` | `/отмена_новостей` | Disable daily news |
| `/useful` | `/foydali` | `/полезное` | Enable daily useful YouTube videos |
| `/useful_off` | `/foydali_bekor` | `/отмена_полезного` | Disable daily useful videos |
| `/uz` | — | — | Switch to Uzbek |
| `/ru` | — | — | Switch to Russian |
| `/en` | — | — | Switch to English |

### Developer commands (group)

| Command | Description |
|---------|-------------|
| `/testNews` | Send news to current group now |
| `/testUseful` | Send useful YouTube videos to current group now |

### Developer commands (bot chat only)

| Command | Description |
|---------|-------------|
| `/settings` | Configure news delivery times |
| `/newsstats` | View news click statistics |
| `/newsstats daryo` | View detailed stats for a source |
| `/usefulstats [YYYY-MM]` | View useful-content click stats per channel for a month |
| `/addChannel <url\|@handle\|UC...>` | Add a YouTube channel to the curated list |
| `/removeChannel <channel_id>` | Deactivate a YouTube channel |
| `/listChannels` | Show all configured YouTube channels |

## Project Structure

```
src/
  bot.ts              — Entry point
  commands/           — Command handlers
  middleware/         — Message tracking & NSFW protection
  services/           — NSFWJS classification, news fetching
  scheduler/          — Daily news cron job
  db/                 — Supabase database helpers
  i18n/               — Translations (uz/ru/en)
  utils/              — Markdown escaping, notifications
schema.sql            — Database DDL (idempotent)
supabase/functions/   — Edge Functions (click tracking)
```

## License

ISC
