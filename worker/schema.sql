-- The anonymous session summaries. Run once in Supabase's SQL editor (project in EU, Frankfurt).
-- No id column on purpose: a row can't be linked to a person, a phone or another row.
-- The checks on the values live in the Worker (index.js), the only one that can write here.

create table public.session_summaries (
  day            date     not null,
  attempts_total smallint not null,
  timed_auto     smallint not null,
  timed_manual   smallint not null,
  near_misses    smallint not null,
  fails          smallint not null,
  avg_ms         integer,
  best_ms        integer,
  record_ms      integer,
  manual_counted boolean  not null,
  app_version    text     not null,
  received_on    date     not null default current_date   -- a date only, never a time
);

-- Row level security on, with no policies: only the Worker's secret key can read or write.
alter table public.session_summaries enable row level security;
revoke all on table public.session_summaries from anon, authenticated;
grant select, insert, delete on table public.session_summaries to service_role;

-- Retention, once the period in the privacy page is decided (run by hand, or schedule it):
-- delete from public.session_summaries where received_on < current_date - interval '6 months';
