-- Drop legacy news tables (replaced by external_news)
drop table if exists public.news_clicks;
drop table if exists public.news;

-- ----------------------------------------------------------------------------
-- External news — fetched from kun.uz and daryo.uz APIs.
-- ----------------------------------------------------------------------------

create table if not exists public.external_news (
  id serial primary key,
  source text not null,            -- 'kun' or 'daryo'
  title text not null,
  link text not null,
  external_id text not null,       -- slug or href from the source API
  category text,
  published_at timestamptz,
  fetched_at timestamptz not null default now()
);

-- Prevent duplicate articles from the same source
create unique index if not exists external_news_source_external_id_uniq
  on public.external_news (source, external_id);

create index if not exists external_news_fetched_at_idx
  on public.external_news (fetched_at desc);

-- ----------------------------------------------------------------------------
-- External news click tracking — counts clicks for partner statistics.
-- ----------------------------------------------------------------------------

create table if not exists public.external_news_clicks (
  id serial primary key,
  news_id integer not null references public.external_news(id) on delete cascade,
  chat_id bigint,
  clicked_at timestamptz not null default now()
);

create index if not exists external_news_clicks_news_id_idx
  on public.external_news_clicks (news_id);
