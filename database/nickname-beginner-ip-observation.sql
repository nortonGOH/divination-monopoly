-- Same-source observation is private; an IP never identifies or bans a player.
CREATE TABLE IF NOT EXISTS public.quiz_nickname_ip_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_digest text NOT NULL REFERENCES public.quiz_nickname_players(token_digest) ON DELETE CASCADE,
  source_ip inet NOT NULL,
  action text NOT NULL CHECK (action IN ('join','answer')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quiz_nickname_ip_activity_time
 ON public.quiz_nickname_ip_activity(occurred_at DESC);
CREATE INDEX IF NOT EXISTS quiz_nickname_ip_activity_ip_time
 ON public.quiz_nickname_ip_activity(source_ip,occurred_at DESC);
ALTER TABLE public.quiz_nickname_ip_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_nickname_ip_activity FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.quiz_nickname_ip_activity TO service_role;
