-- New IP audit, accessible only by a server-side writer and admin-approved report.
CREATE TABLE IF NOT EXISTS public.quiz_traffic_ip_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source_ip inet NOT NULL,
  event_type text NOT NULL CHECK(event_type IN ('page_view','click')),
  page text NOT NULL CHECK(page IN ('home','atlas')),
  source text NOT NULL CHECK(source IN ('direct','search','social','referral','internal','unknown')),
  target text
);
ALTER TABLE public.quiz_traffic_ip_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_traffic_ip_events FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,DELETE ON public.quiz_traffic_ip_events TO service_role;
CREATE INDEX IF NOT EXISTS quiz_traffic_ip_events_recent ON public.quiz_traffic_ip_events(occurred_at DESC);
