-- Supabase schema entry point.
-- Include directives are expanded by `scripts/build-schema.mjs` into the
-- single-file `schema.sql` you paste into the Supabase SQL Editor.
-- Order matters: later files reference tables/functions defined earlier.
--
-- To run directly against psql (e.g. `psql -f index.sql`), the \i directives
-- below are also valid psql include commands, so this file is dual-use.

\i groups.sql
\i settings.sql
\i external_news.sql
\i sensitive.sql
\i pending_bans.sql
\i message_authors.sql
\i pending_cards.sql
\i stats.sql
\i youtube.sql
\i users.sql
\i rls.sql
\i pg_cron.sql
