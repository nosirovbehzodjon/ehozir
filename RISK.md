# Known Risks

Tracked risks across performance, scalability, reliability, and data correctness.
Status: `open` = not yet fixed, `fixed` = resolved.

---

## 1. PostgREST 1000-Row Limit

Supabase PostgREST silently truncates query results at 1000 rows. Any SELECT without `.maybeSingle()` / `.single()` that could return 1000+ rows will lose data.

| # | Location | Table | Status | Impact |
|---|----------|-------|--------|--------|
| 1.1 | `src/db/weeklyWinners.ts` — `getWeeklyActivity()` | `logs` (via RPC) | **fixed** | Weekly stats missed users whose rows fell beyond the 1000 cap. Fixed by pivoting aggregation server-side (one row per user). |
| 1.2 | `src/db/groups.ts:67` — `getGroupMembers()` | `group_members` | open | Groups with 1000+ tracked members: `/hamma` silently skips members. |
| 1.3 | `src/db/weeklyWinners.ts:225` — `getActivityFromTable()` | `weekly_stats` / `monthly_stats` / `yearly_stats` | open | Monthly/yearly stats for groups with 1000+ users silently truncated. |
| 1.4 | `src/db/usefulContent.ts:192` — `getMonthlyUsefulClicksByChannel()` | `useful_content_clicks` | open | If a month has 1000+ clicks, channel stats are undercounted. |
| 1.5 | `src/db/news.ts:167` — `getSourceSummaryStats()` | `external_news` | open | If 1000+ articles exist in 30 days, `/newsstats` summary is incomplete. |

---

## 2. Telegram API Rate Limits

Telegram enforces ~30 msgs/sec per bot and ~20 msgs/min per group. No rate limiting is implemented.

| # | Location | Status | Impact |
|---|----------|--------|--------|
| 2.1 | `src/scheduler/dailyNews.ts` — news delivery loop | open | 100+ groups: some groups miss news due to "Too many requests" errors. |
| 2.2 | `src/scheduler/usefulContent.ts` — useful/english content delivery loop | open | Same as above for useful/english content. |
| 2.3 | `src/scheduler/weeklyStats.ts:296` — developer approval prompts | open | Many groups x multiple developers = burst of messages; some may fail. |

---

## 3. N+1 Query Patterns

Loops that make individual DB or HTTP calls per item instead of batching.

| # | Location | Status | Impact |
|---|----------|--------|--------|
| 3.1 | `src/scheduler/weeklyStats.ts:135-158` — winner/top10 resolution | open | For each group: up to 17 sequential `getGroupMember()` DB calls + 17 `getUserAvatar()` HTTP calls. With many groups this compounds. |
| 3.2 | `src/scheduler/usefulContent.ts` — `resolvePendingChannels()` | open | One YouTube API call per pending channel, sequentially. 10 pending channels = ~50s of latency. |
| 3.3 | `src/db/usefulContent.ts:135` — `incrementUsefulContentSent()` fallback | open | If RPC fails, falls back to one UPDATE per row in a sequential loop. |

---

## 4. Scheduler Overlap

Cron jobs have no mutex/lock. If a run takes longer than the interval, the next run starts concurrently.

| # | Location | Cron | Status | Impact |
|---|----------|------|--------|--------|
| 4.1 | `src/scheduler/dailyNews.ts` | `0 * * * *` (hourly) | open | If news delivery to 100+ groups takes >60min, duplicate messages. |
| 4.2 | `src/scheduler/usefulContent.ts` | `0 * * * *` (hourly) | open | Same overlap risk; compounds if news + useful both fire same hour. |
| 4.3 | `src/scheduler/weeklyStats.ts` | `0 3 * * 1` (weekly) | open | If stats job takes >1h (avatar downloads, PNG renders, uploads), duplicates. |

---

## 5. Fire-and-Forget / Silent Failures

Operations that silently swallow errors, causing data loss or incorrect behavior.

| # | Location | Status | Impact |
|---|----------|--------|--------|
| 5.1 | `src/middleware/statsLogger.ts:46` — `rememberAuthorDb(...).catch(() => {})` | open | If author caching fails silently, `reaction_received` stats attribute to wrong user after bot restart. Empty catch = no logging. |
| 5.2 | `src/scheduler/weeklyStats.ts:381` — scheduler `.catch()` only logs | open | If `processGroup` fails, error is logged but developers are not notified via Telegram. |

---

## 6. Race Conditions

| # | Location | Status | Impact |
|---|----------|--------|--------|
| 6.1 | `src/db/news.ts:20-50` — `getGroupsWithNewsEnabled()` | open | Two separate queries for groups + language. If language changes between queries, news sent in wrong language. |
| 6.2 | `src/db/usefulContent.ts:261-293` — `getGroupsWithFeatureEnabled()` | open | Same two-query pattern; useful/english content could use wrong language. |

---

## 7. Memory

| # | Location | Status | Impact |
|---|----------|--------|--------|
| 7.1 | `src/services/statsCard.ts:76` — avatar cache (500 entries) | open | 500 base64 data URLs at ~50KB each = up to ~25MB in memory. Bounded but large. |
| 7.2 | `src/middleware/statsLogger.ts:26` — author cache (20k entries) | open | ~680KB, properly bounded with FIFO eviction. Low risk but could thrash under high volume. |
