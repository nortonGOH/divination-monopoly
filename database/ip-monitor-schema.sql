-- IP monitoring is admin-only; install in a separate test database first.
CREATE TABLE IF NOT EXISTS public.quiz_ip_monitor_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_ip inet NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 kind text NOT NULL CHECK(kind IN ('view','click','trial')),
 page text NOT NULL CHECK(page IN ('home','atlas')),
 source text NOT NULL CHECK(source IN ('direct','search','social','referral','internal','unknown')),
 target text NOT NULL DEFAULT '' CHECK(length(target)<=80),
 denied boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS quiz_ip_monitor_events_ip_time ON public.quiz_ip_monitor_events(source_ip,occurred_at DESC);
ALTER TABLE public.quiz_ip_monitor_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_ip_monitor_events FROM public,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.quiz_ip_monitor_events TO service_role;
CREATE TABLE IF NOT EXISTS public.quiz_ip_monitor_blocks(
 source_ip inet PRIMARY KEY,
 reason text NOT NULL CHECK(length(reason) BETWEEN 2 AND 200),
 blocked_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 blocked_by uuid NOT NULL REFERENCES auth.users(id)
);
ALTER TABLE public.quiz_ip_monitor_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_ip_monitor_blocks FROM public,anon,authenticated;
GRANT SELECT ON public.quiz_ip_monitor_blocks TO service_role;
