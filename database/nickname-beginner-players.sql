-- Server-owned nickname identity and beginner score. No IP blocking.
CREATE TABLE IF NOT EXISTS public.quiz_nickname_players (
  token_digest text PRIMARY KEY CHECK (token_digest ~ '^[a-f0-9]{64}$'),
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 18),
  total_attempts bigint NOT NULL DEFAULT 0 CHECK (total_attempts >= 0),
  correct_attempts bigint NOT NULL DEFAULT 0 CHECK (correct_attempts >= 0 AND correct_attempts <= total_attempts),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- The database index enforces uniqueness atomically, including concurrent sign-ups.
-- Leading/trailing spaces and letter case do not create another player.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_nickname_players_unique_name
 ON public.quiz_nickname_players ((lower(btrim(nickname))));
ALTER TABLE public.quiz_nickname_players ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_nickname_players FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.quiz_nickname_players TO service_role;
