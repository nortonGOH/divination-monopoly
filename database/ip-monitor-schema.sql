-- Observation only: source IP page and click activity. No blocking or access control.
CREATE TABLE IF NOT EXISTS public.quiz_ip_monitor_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_ip inet NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 kind text NOT NULL CHECK (kind IN ('view','click')),
 page text NOT NULL CHECK (page IN ('home','atlas')),
 source text NOT NULL CHECK (source IN ('direct','search','social','referral','internal','unknown')),
 target text NOT NULL DEFAULT '' CHECK (length(target)<=80)
);
CREATE INDEX IF NOT EXISTS quiz_ip_monitor_events_time ON public.quiz_ip_monitor_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS quiz_ip_monitor_events_ip_time ON public.quiz_ip_monitor_events (source_ip,occurred_at DESC);
ALTER TABLE public.quiz_ip_monitor_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_ip_monitor_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.quiz_ip_monitor_events TO service_role;
