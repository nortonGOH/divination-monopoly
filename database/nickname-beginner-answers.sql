-- One scored attempt per beginner question per nickname session.
CREATE TABLE IF NOT EXISTS public.quiz_nickname_answers (
  token_digest text NOT NULL REFERENCES public.quiz_nickname_players(token_digest) ON DELETE CASCADE,
  question_id text NOT NULL REFERENCES public.quiz_questions(id),
  correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token_digest, question_id)
);
ALTER TABLE public.quiz_nickname_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_nickname_answers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.quiz_nickname_answers TO service_role;
