-- ----------------------------------------------------------------------------
-- pg_cron schedule — runs inside Postgres, survives bot restarts.
-- Enable the extension (Supabase: Database → Extensions → enable pg_cron).
-- Must be loaded last: all referenced aggregate functions need to exist first.
-- ----------------------------------------------------------------------------

create extension if not exists pg_cron;

-- Drop existing jobs before re-creating (idempotent re-run).
do $$
begin
  perform cron.unschedule(jobid)
    from cron.job
   where jobname in ('aggregate_weekly_stats',
                     'aggregate_monthly_stats',
                     'aggregate_yearly_stats',
                     'purge_message_authors');
end;
$$;

-- Weekly: every Monday at 00:05 UTC
select cron.schedule('aggregate_weekly_stats',  '5 0 * * 1', $$select public.aggregate_weekly_stats();$$);
-- Monthly: 1st of month at 00:15 UTC
select cron.schedule('aggregate_monthly_stats', '15 0 1 * *', $$select public.aggregate_monthly_stats();$$);
-- Yearly: Jan 1 at 00:30 UTC
select cron.schedule('aggregate_yearly_stats',  '30 0 1 1 *', $$select public.aggregate_yearly_stats();$$);
-- Daily at 03:00 UTC: drop message_authors rows older than 7 days
select cron.schedule('purge_message_authors',   '0 3 * * *', $$delete from public.message_authors where created_at < now() - interval '7 days';$$);
