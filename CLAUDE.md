# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Telegram bot (TypeScript + grammY) that mentions all group members when `/hamma` or `/all` commands are used in groups. Members are tracked as they send messages and persisted to a Supabase Postgres database, so data survives restarts and the bot can scale across many groups.

## Common Commands

- **Start the bot (development):** `npm run dev`
- **Start the bot (production):** `npm run build && npm start`
- **Typecheck:** `npm run typecheck`
- **Install dependencies:** `npm install`

## Architecture

### Core Components

1. **src/bot.ts** — Main entry point
   - Initializes the grammY bot with polling
   - Listens to every message in groups/supergroups; upserts the chat and the sender via `upsertGroupAndMember()`
   - Listens to `message:new_chat_members` to capture users added by another user
   - Listens to `chat_member` updates to capture users who join via invite link / username (requires bot to be admin AND `chat_member` opted into via `allowed_updates`)
   - Handles `/hamma` and `/all` commands by querying `getGroupMembers()` and building a MarkdownV2 mention message
   - Handles `/stats` command — calls `ctx.getChatMemberCount()`, persists it, and replies with `tracked` (DB) vs `total` (Telegram API)
   - Excludes bots from the mention list

2. **src/supabase.ts** — Supabase client and DB helpers
   - Creates a service-role Supabase client (no session persistence)
   - `upsertGroupAndMember(chat, user)` — upserts into `groups` and `group_members`
   - `getGroupMembers(chatId)` — returns non-bot members for a chat
   - `setTelegramMemberCount(chatId, count)` — writes the live Telegram total + timestamp to `groups`
   - `getGroupStats(chatId)` — returns `{ tracked, total, totalUpdatedAt }`

3. **schema.sql** — Idempotent DDL for the Supabase tables, plus a trigger that keeps `groups.member_count` in sync with `group_members`. Re-run any time the schema changes — all statements use `if not exists` / `add column if not exists` / `create or replace`.

### Database Schema (Supabase / Postgres)

- `groups(chat_id PK, title, type, username, member_count, telegram_member_count, telegram_member_count_updated_at, created_at, updated_at)`
  - `member_count` — count of non-bot rows in `group_members` for this chat. Maintained automatically by trigger `group_members_count_trg`.
  - `telegram_member_count` / `telegram_member_count_updated_at` — true total from `getChatMemberCount`, refreshed whenever someone runs `/stats`.
- `group_members(chat_id FK→groups ON DELETE CASCADE, user_id, username, first_name, last_name, is_bot, language_code, first_seen, last_seen, PK(chat_id, user_id))`
- Index: `group_members_chat_id_idx` on `(chat_id)`
- Trigger: `group_members_count_trg` (after insert/update/delete on `group_members`) → calls `refresh_group_member_count(chat_id)` to keep `groups.member_count` accurate.

### Key Design Decisions

- **Persistent storage via Supabase**: Per-group member lists live in Postgres, keyed by `chat_id`. Safe to restart and to deploy across many groups worldwide.
- **Service role key**: The bot is a trusted backend, so it uses the `service_role` key and bypasses RLS. Never expose this key client-side.
- **Multi-source member tracking**: Members are captured from three sources — outgoing messages (`bot.on("message")`), service messages when added by another user (`message:new_chat_members`), and `chat_member` status updates (joins via link/username, promotions). The `chat_member` source requires the bot to be an admin in the group.
- **`allowed_updates` opt-in**: `chat_member` and `my_chat_member` are NOT delivered by Telegram by default — they must be listed in `bot.start({ allowed_updates: [...] })`.
- **Telegram API has no member-list endpoint**: There is no way to enumerate existing members of a group. `getChatMemberCount` returns only the total integer (used by `/stats`); to mention people they must first appear via one of the three tracking sources above.
- **Upsert on every message**: Each incoming message refreshes `last_seen` and any changed profile fields (username, names). Cheap and keeps data fresh.
- **Member count via DB trigger**: `groups.member_count` is maintained by a Postgres trigger so the bot doesn't need to recount on every write. The count excludes bots (matches `/all` behavior).
- **Mention format**: Uses MarkdownV2 `[name](tg://user?id=ID)` for clickable mentions. Note: this format does NOT trigger push notifications — consider switching to message `entities` with `text_mention` for true notifications.

## Environment Setup

Required environment variables in `.env`:

- `TELEGRAM_BOT_TOKEN` — bot token from @BotFather
- `SUPABASE_URL` — Supabase project URL (e.g. `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key from Project Settings → API

The bot exits on startup if any of these are missing.

**Database setup:** Open Supabase Dashboard → SQL Editor → paste `schema.sql` → Run. The script is idempotent and should be re-run any time `schema.sql` changes (new columns, new triggers, etc.).

## Commands

- `/hamma`, `/all` — mention every tracked non-bot member of the current group
- `/stats` — show `tracked` (DB) vs `total` (live Telegram API) member counts; refreshes the cached `telegram_member_count` on each call

## Important Limitations & Future Improvements

- **Limited member discovery**: Even with three tracking sources (messages, `new_chat_members`, `chat_member`), members who existed in the group before the bot joined and never speak/leave/rejoin will never be tracked. There is no Telegram API to enumerate them.
- **`chat_member` requires admin**: Without admin rights, joins via invite link or username are silently dropped by Telegram.
- **No admin permission handling**: Bot doesn't validate whether the user running `/hamma` or `/all` has permission
- **Mentions don't notify**: MarkdownV2 user links are clickable but silent. For real notifications, switch to `entities` with `text_mention` type.
- **No rate limiting / batching**: Very large groups may exceed Telegram message length or rate limits — consider chunking the mention message.
- **Service role key in `.env`**: Keep `.env` out of version control. For production, inject via the host's secret manager.

## Dependencies

- `grammy` — Telegram Bot API framework (TypeScript-first)
- `@supabase/supabase-js` — Supabase client for Postgres access
- `dotenv` — Environment variable management
- `typescript`, `ts-node-dev`, `@types/node` (dev) — TypeScript tooling and auto-reload
